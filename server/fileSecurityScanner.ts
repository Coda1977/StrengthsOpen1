import crypto from 'crypto';

interface SecurityScanResult {
  isSecure: boolean;
  threats: string[];
  warnings: string[];
}

// Known malicious file signatures (magic bytes)
const MALICIOUS_SIGNATURES = [
  // Executable files
  Buffer.from([0x4D, 0x5A]), // PE/DOS executables (.exe, .dll)
  Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executables (Linux)
  Buffer.from([0xFE, 0xED, 0xFA, 0xCE]), // Mach-O executables (macOS)
  Buffer.from([0xFE, 0xED, 0xFA, 0xCF]), // Mach-O 64-bit executables
  
  // Script files
  Buffer.from('#!/bin/sh'), // Shell scripts
  Buffer.from('#!/bin/bash'), // Bash scripts
  Buffer.from('<?php'), // PHP scripts
  Buffer.from('<script'), // HTML/JS scripts
  
  // Archive files with potential threats
  Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP files (can contain malware)
  Buffer.from([0x52, 0x61, 0x72, 0x21]), // RAR files
];

// Suspicious patterns in text content
const SUSPICIOUS_PATTERNS = [
  /eval\s*\(/gi,
  /exec\s*\(/gi,
  /system\s*\(/gi,
  /shell_exec\s*\(/gi,
  /passthru\s*\(/gi,
  /base64_decode\s*\(/gi,
  /<script[^>]*>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:text\/html/gi,
  /\$_GET\[/gi,
  /\$_POST\[/gi,
  /\$_REQUEST\[/gi,
  /document\.write\s*\(/gi,
  /innerHTML\s*=/gi,
];

export function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts
  let sanitized = filename.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  
  // Remove non-alphanumeric characters except dots, hyphens, and underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit filename length
  if (sanitized.length > 100) {
    const extension = sanitized.split('.').pop();
    sanitized = sanitized.substring(0, 96) + '.' + extension;
  }
  
  return sanitized;
}

export function scanFileBuffer(buffer: Buffer, filename: string): SecurityScanResult {
  const result: SecurityScanResult = {
    isSecure: true,
    threats: [],
    warnings: []
  };
  
  // Check file size
  if (buffer.length === 0) {
    result.isSecure = false;
    result.threats.push('Empty file detected');
    return result;
  }
  
  if (buffer.length > 5 * 1024 * 1024) { // 5MB limit
    result.isSecure = false;
    result.threats.push('File size exceeds security limit');
    return result;
  }
  
  // Check for malicious file signatures
  for (const signature of MALICIOUS_SIGNATURES) {
    if (buffer.indexOf(signature) === 0) {
      result.isSecure = false;
      result.threats.push(`Potentially malicious file signature detected`);
      return result;
    }
  }
  
  // Convert buffer to string for content analysis (first 10KB only for performance)
  const contentToScan = buffer.slice(0, 10 * 1024).toString('utf8', 0, Math.min(buffer.length, 10 * 1024));
  
  // Check for suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(contentToScan)) {
      result.isSecure = false;
      result.threats.push(`Suspicious code pattern detected: ${pattern.source}`);
    }
  }
  
  // Additional checks for specific file types
  const extension = filename.toLowerCase().split('.').pop();
  
  if (['jpg', 'jpeg', 'png'].includes(extension)) {
    // Check for embedded scripts in images
    if (contentToScan.includes('<script') || contentToScan.includes('javascript:')) {
      result.isSecure = false;
      result.threats.push('Embedded script detected in image file');
    }
  }
  
  if (['csv', 'xlsx', 'xls'].includes(extension)) {
    // Check for formula injection
    if (/^[=@+\-]/.test(contentToScan.trim())) {
      result.warnings.push('Potential formula injection detected');
    }
  }
  
  // Check for null bytes (potential file smuggling)
  if (buffer.indexOf(0x00) !== -1 && !['xlsx', 'xls', 'docx', 'png', 'jpg', 'jpeg'].includes(extension)) {
    result.warnings.push('Null bytes detected in text file');
  }
  
  return result;
}

export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function validateFileIntegrity(buffer: Buffer, expectedMimeType: string): boolean {
  // Validate file headers match expected MIME types
  const fileSignatures = {
    'text/csv': (buf: Buffer) => {
      // CSV files should contain only printable ASCII characters and common separators
      const sample = buf.slice(0, 1024).toString('utf8');
      return /^[\x20-\x7E\r\n,;"\t]*$/.test(sample);
    },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (buf: Buffer) => {
      // XLSX files are ZIP archives with specific structure
      return buf.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    },
    'application/vnd.ms-excel': (buf: Buffer) => {
      // XLS files have Microsoft Office signature
      return buf.slice(0, 8).equals(Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]));
    },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buf: Buffer) => {
      // DOCX files are ZIP archives
      return buf.slice(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]));
    },
    'image/png': (buf: Buffer) => {
      return buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    },
    'image/jpeg': (buf: Buffer) => {
      return buf.slice(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]));
    }
  };
  
  const validator = fileSignatures[expectedMimeType];
  return validator ? validator(buffer) : false;
}