import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import OpenAI from 'openai';

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
  let extractedText = '';

  try {
    switch (mimetype) {
      case 'text/csv':
      case 'application/vnd.ms-excel':
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // Parse Excel/CSV files
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        extractedText = csvData;
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
        // OCR for images with better error handling
        let imageWorker;
        try {
          imageWorker = await createWorker('eng');
          const imageResult = await imageWorker.recognize(buffer);
          extractedText = imageResult.data.text;
        } catch (ocrError) {
          console.error('OCR processing failed:', ocrError);
          throw new Error('Image text recognition failed. Please ensure the image contains clear, readable text.');
        } finally {
          if (imageWorker) {
            try {
              await imageWorker.terminate();
            } catch (terminateError) {
              console.error('Failed to terminate OCR worker:', terminateError);
            }
          }
        }
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