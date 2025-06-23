import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import OpenAI from 'openai';
import { scanFileBuffer, validateFileIntegrity, sanitizeFilename, generateFileHash } from './fileSecurityScanner';
import { resourceManager, ocrWorkerPool } from './resourceManager';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TeamMemberData {
  name: string;
  strengths: string[];
}

// List of all 34 CliftonStrengths for validation
const ALL_STRENGTHS = [
  'Achiever', 'Activator', 'Adaptability', 'Analytical', 'Arranger', 'Belief', 'Command', 'Communication',
  'Competition', 'Connectedness', 'Consistency', 'Context', 'Deliberative', 'Developer', 'Discipline',
  'Empathy', 'Focus', 'Futuristic', 'Harmony', 'Ideation', 'Includer', 'Individualization', 'Input',
  'Intellection', 'Learner', 'Maximizer', 'Positivity', 'Relator', 'Responsibility', 'Restorative',
  'Self-Assurance', 'Significance', 'Strategic', 'Woo'
];

async function extractTextWithAI(text: string): Promise<TeamMemberData[]> {
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key not found');
    throw new Error('AI processing is not available. Please configure the OpenAI API key.');
  }

  const prompt = `Extract team member names and their CliftonStrengths from this text. 

Valid CliftonStrengths are: ${ALL_STRENGTHS.join(', ')}

Text to analyze:
${text.substring(0, 4000)} ${text.length > 4000 ? '...(truncated)' : ''}

Return a JSON object with this exact format:
{
  "members": [
    {
      "name": "John Doe",
      "strengths": ["Achiever", "Strategic", "Learner", "Analytical", "Focus"]
    }
  ]
}

Rules:
- Each person should have 1-5 strengths maximum
- Only use exact strength names from the valid list
- If a strength name is slightly different, match to the closest valid one
- If no valid strengths are found for a person, use an empty array
- Return valid JSON only, no other text`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at extracting structured data from text. Return only valid JSON with a 'members' array."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const result = JSON.parse(content);
    return result.members || [];
  } catch (error) {
    console.error('AI extraction error:', error);
    if (error.message?.includes('API key')) {
      throw new Error('OpenAI API key is invalid or expired. Please check your API key configuration.');
    }
    throw new Error('Failed to process file with AI. Please try a different file format or check the file content.');
  }
}

export async function parseTeamMembersFile(buffer: Buffer, mimetype: string, filename: string): Promise<TeamMemberData[]> {
  // Track buffer for memory management
  resourceManager.trackBuffer(buffer);
  
  try {
    // Security validation first
    const sanitizedFilename = sanitizeFilename(filename);
    const fileHash = generateFileHash(buffer);
    
    console.log(`Processing file: ${sanitizedFilename} (hash: ${fileHash})`);
    
    // Scan for malicious content
    const scanResult = scanFileBuffer(buffer, sanitizedFilename);
    if (!scanResult.isSecure) {
      throw new Error(`Security threat detected: ${scanResult.threats.join(', ')}`);
    }
    
    // Log warnings but continue processing
    if (scanResult.warnings.length > 0) {
      console.warn(`File security warnings for ${sanitizedFilename}:`, scanResult.warnings);
    }
    
    // Validate file integrity
    if (!validateFileIntegrity(buffer, mimetype)) {
      throw new Error('File integrity validation failed. File content does not match expected format.');
    }
    
    let extractedText = '';

    return await processFileWithCleanup(buffer, mimetype, sanitizedFilename);
  } finally {
    // Always release buffer regardless of success or failure
    resourceManager.releaseBuffer(buffer);
  }
}

async function processFileWithCleanup(buffer: Buffer, mimetype: string, sanitizedFilename: string): Promise<TeamMemberData[]> {
  let extractedText = '';

  try {
    switch (mimetype) {
      case 'text/csv':
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // Parse Excel/CSV files with security measures
        try {
          const workbook = XLSX.read(buffer, { 
            type: 'buffer',
            cellFormula: false, // Disable formula parsing for security
            cellHTML: false,    // Disable HTML parsing
            cellNF: false,      // Disable number format parsing
            cellDates: false,   // Disable date parsing to prevent injection
            sheetStubs: false,  // Don't create stub cells
          });
          
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('No valid sheets found in file');
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to CSV with security sanitization
          const csvData = XLSX.utils.sheet_to_csv(worksheet, {
            forceQuotes: false,
            blankrows: false,
          });
          
          // Sanitize CSV data to prevent injection attacks
          extractedText = csvData
            .replace(/^[=@+\-]/gm, '') // Remove formula prefixes
            .replace(/\x00/g, '') // Remove null bytes
            .substring(0, 50000); // Limit text size
          
        } catch (xlsxError) {
          console.error('Excel/CSV parsing error:', xlsxError);
          throw new Error('Failed to parse spreadsheet file. Please ensure it\'s a valid Excel or CSV file.');
        }
        break;

      case 'application/pdf':
        // For PDF files, return error since OCR on PDFs is not reliable
        throw new Error('PDF file processing is not supported. Please convert to text, Excel, or Word format.');

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        // Parse Word documents
        const docResult = await mammoth.extractRawText({ buffer });
        extractedText = docResult.value;
        break;

      case 'image/png':
      case 'image/jpeg':
      case 'image/jpg':
        // OCR for images with enhanced security and proper resource management
        extractedText = await processImageWithOCR(buffer);
        break;

      default:
        throw new Error(`Unsupported file type: ${mimetype}`);
    }

    // Use AI to extract structured data from the text
    const teamMembers = await extractTextWithAI(extractedText);
    
    // Validate and clean the data
    return teamMembers.filter(member => 
      member.name && 
      member.name.trim().length > 0 && 
      Array.isArray(member.strengths) &&
      member.strengths.every(strength => ALL_STRENGTHS.includes(strength))
    ).map(member => ({
      name: member.name.trim(),
      strengths: member.strengths.slice(0, 5) // Limit to 5 strengths maximum
    }));

  } catch (error) {
    console.error('File parsing error:', error);
    throw new Error(`Failed to parse file: ${error.message}`);
  }
}

async function processImageWithOCR(buffer: Buffer): Promise<string> {
  let worker = null;
  
  try {
    // Additional image security checks
    if (buffer.length < 100) {
      throw new Error('Image file too small to be valid');
    }
    
    // Check for suspicious embedded content
    const imageString = buffer.toString('binary', 0, Math.min(buffer.length, 1024));
    if (imageString.includes('<script') || imageString.includes('javascript:')) {
      throw new Error('Potentially malicious content detected in image');
    }
    
    // Get worker from pool with timeout
    const workerPromise = ocrWorkerPool.getWorker();
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout getting OCR worker'));
      }, 30000);
      resourceManager.trackTimeout(timeout);
    });
    
    worker = await Promise.race([workerPromise, timeoutPromise]);
    
    // Set security-focused OCR options with timeout
    const optionsTimeout = setTimeout(() => {
      throw new Error('OCR options timeout');
    }, 10000);
    resourceManager.trackTimeout(optionsTimeout);
    
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:!?()-[]{}"\'/\\|@#$%^&*+=_~`',
      tessedit_pageseg_mode: '6', // Assume uniform block of text
    });
    
    clearTimeout(optionsTimeout);
    
    // Process image with timeout
    const recognitionTimeout = setTimeout(() => {
      throw new Error('OCR recognition timeout');
    }, 60000); // 1 minute timeout
    resourceManager.trackTimeout(recognitionTimeout);
    
    const imageResult = await worker.recognize(buffer);
    clearTimeout(recognitionTimeout);
    
    let extractedText = imageResult.data.text;
    
    // Sanitize OCR output
    extractedText = extractedText.replace(/[^\x20-\x7E\r\n]/g, ''); // Remove non-printable chars
    extractedText = extractedText.substring(0, 10000); // Limit output size
    
    return extractedText;
    
  } catch (ocrError) {
    console.error('OCR processing failed:', ocrError);
    throw new Error('Image text recognition failed. Please ensure the image contains clear, readable text and no embedded scripts.');
  } finally {
    // Always release worker back to pool
    if (worker) {
      try {
        ocrWorkerPool.releaseWorker(worker);
      } catch (releaseError) {
        console.error('Failed to release OCR worker:', releaseError);
        // Force cleanup if release fails
        await resourceManager.terminateWorker(worker);
      }
    }
  }
}