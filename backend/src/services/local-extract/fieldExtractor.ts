import type { ExtractedKycData } from './types.js';

/**
 * Field extraction using keyword proximity analysis
 * No regex, no LLM - pure string analysis
 */

// Keywords that typically precede the target field values
const FIELD_KEYWORDS: Record<string, string[]> = {
  fullName: [
    'name', 'full name', 'name of', 'applicant', 'holder', 'card holder',
    'employee', 'student', 'individual', 'mr', 'mrs', 'ms', 'shri', 'smt',
  ],
  dateOfBirth: [
    'dob', 'date of birth', 'birth date', 'born', 'd.o.b', 'd o b',
    'date of birth:', 'dob:', 'birth:',
  ],
  gender: [
    'gender', 'sex', 'male', 'female', 'transgender',
  ],
  aadhaarNumber: [
    'aadhaar', 'aadhar', 'uid', 'unique identification', 'uidai',
    'government of india', 'enrollment', 'enrolment',
  ],
  panNumber: [
    'pan', 'permanent account number', 'income tax', 'income tax department',
    'account number',
  ],
  fathersName: [
    'father', "father's name", 'father name', 's/o', 'd/o', 'c/o',
    'son of', 'daughter of', 'wife of',
  ],
  address: [
    'address', 'addr', 'residence', 'residential', 'house', 'street',
    'road', 'village', 'city', 'district', 'state', 'pincode', 'pin',
  ],
};

// Gender detection keywords
const GENDER_MALE = ['male', 'm', 'mr', 'shri', 'sri', 'son of', 's/o'];
const GENDER_FEMALE = ['female', 'f', 'mrs', 'ms', 'smt', 'kumari', 'daughter of', 'd/o', 'wife of', 'w/o'];

/**
 * Extract KYC fields from OCR text using keyword proximity
 */
export function extractKycFields(text: string): ExtractedKycData {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const fullTextLower = text.toLowerCase();

  const raw: Record<string, string[]> = {};

  // Extract each field
  const fullName = extractName(lines, fullTextLower);
  const dateOfBirth = extractDob(lines, fullTextLower);
  const gender = extractGender(lines, fullTextLower);
  const aadhaarNumber = extractAadhaarNumber(lines, fullTextLower);
  const panNumber = extractPanNumber(lines, fullTextLower);
  const fathersName = extractFathersName(lines, fullTextLower);
  const address = extractAddress(lines, fullTextLower);

  // Determine document type
  let documentType: 'AADHAAR' | 'PAN' | 'UNKNOWN' = 'UNKNOWN';
  if (aadhaarNumber || fullTextLower.includes('aadhaar') || fullTextLower.includes('uidai')) {
    documentType = 'AADHAAR';
  } else if (panNumber || fullTextLower.includes('income tax department') || fullTextLower.includes('permanent account')) {
    documentType = 'PAN';
  }

  return {
    documentType,
    fullName,
    dateOfBirth,
    gender,
    aadhaarNumber,
    vid: '',
    panNumber,
    fathersName,
    address,
    raw,
  };
}

function extractName(lines: string[], fullTextLower: string): string {
  // Look for name after "Name" keyword
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    // Check if line contains name keyword
    for (const keyword of FIELD_KEYWORDS.fullName) {
      if (line.includes(keyword)) {
        // Try to extract name from same line after keyword
        const afterKeyword = lines[i].slice(line.indexOf(keyword) + keyword.length).trim();
        const cleaned = cleanFieldValue(afterKeyword);
        if (isLikelyName(cleaned)) {
          return cleaned;
        }

        // Check next line
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (isLikelyName(nextLine)) {
            return nextLine;
          }
        }
      }
    }
  }

  // Fallback: look for lines that look like names (2-4 words, all letters)
  for (const line of lines) {
    if (isLikelyName(line) && line.length > 5 && line.length < 60) {
      return line;
    }
  }

  return '';
}

function extractDob(lines: string[], fullTextLower: string): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    for (const keyword of FIELD_KEYWORDS.dateOfBirth) {
      if (line.includes(keyword)) {
        // Look for date pattern in same or next line
        const dateMatch = findDatePattern(lines[i]) || (i + 1 < lines.length ? findDatePattern(lines[i + 1]) : null);
        if (dateMatch) {
          return dateMatch;
        }
      }
    }
  }

  // Fallback: search entire text for date patterns
  return findDatePattern(fullTextLower) || '';
}

function extractGender(lines: string[], fullTextLower: string): string {
  // Look for explicit gender markers
  for (const line of lines) {
    const lineLower = line.toLowerCase().trim();

    // Check for explicit gender labels
    if (lineLower.includes('gender') || lineLower.includes('sex')) {
      if (lineLower.includes('male') && !lineLower.includes('female')) {
        return 'MALE';
      }
      if (lineLower.includes('female')) {
        return 'FEMALE';
      }
    }

    // Check for standalone gender words
    if (lineLower === 'male' || lineLower === 'm') {
      return 'MALE';
    }
    if (lineLower === 'female' || lineLower === 'f') {
      return 'FEMALE';
    }
  }

  // Check for gender in full text with word boundaries
  if (fullTextLower.includes(' male') || fullTextLower.includes('male ') || fullTextLower.includes('/m/')) {
    return 'MALE';
  }
  if (fullTextLower.includes(' female') || fullTextLower.includes('female ') || fullTextLower.includes('/f/')) {
    return 'FEMALE';
  }

  return '';
}

function extractAadhaarNumber(lines: string[], fullTextLower: string): string {
  // Aadhaar is 12 digits, often displayed as 4-4-4
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for lines with aadhaar context
    const lineLower = line.toLowerCase();
    const hasAadhaarContext = FIELD_KEYWORDS.aadhaarNumber.some((kw) => lineLower.includes(kw));

    if (hasAadhaarContext || isNearAadhaarKeyword(lines, i)) {
      // Extract 12-digit number (with or without spaces)
      const numberMatch = extract12DigitNumber(line);
      if (numberMatch) {
        return numberMatch;
      }

      // Check next line
      if (i + 1 < lines.length) {
        const nextMatch = extract12DigitNumber(lines[i + 1]);
        if (nextMatch) {
          return nextMatch;
        }
      }
    }
  }

  // Fallback: find any 12-digit number that looks like aadhaar
  for (const line of lines) {
    const match = extract12DigitNumber(line);
    if (match && !isLikelyDate(line) && !isLikelyPhone(line)) {
      return match;
    }
  }

  return '';
}

function extractPanNumber(lines: string[], fullTextLower: string): string {
  // PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    const hasPanContext = FIELD_KEYWORDS.panNumber.some((kw) => lineLower.includes(kw));

    if (hasPanContext || isNearPanKeyword(lines, i)) {
      const panMatch = extractPanFormat(line);
      if (panMatch) {
        return panMatch;
      }

      if (i + 1 < lines.length) {
        const nextMatch = extractPanFormat(lines[i + 1]);
        if (nextMatch) {
          return nextMatch;
        }
      }
    }
  }

  // Fallback: search for PAN format anywhere
  for (const line of lines) {
    const match = extractPanFormat(line);
    if (match) {
      return match;
    }
  }

  return '';
}

function extractFathersName(lines: string[], fullTextLower: string): string {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    for (const keyword of FIELD_KEYWORDS.fathersName) {
      if (line.includes(keyword)) {
        // Extract name after father keyword
        const afterKeyword = lines[i].slice(line.indexOf(keyword) + keyword.length).trim();
        const cleaned = cleanFieldValue(afterKeyword);
        if (isLikelyName(cleaned)) {
          return cleaned;
        }

        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (isLikelyName(nextLine)) {
            return nextLine;
          }
        }
      }
    }
  }

  return '';
}

function extractAddress(lines: string[], fullTextLower: string): string {
  const addressLines: string[] = [];
  let collecting = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();

    // Start collecting after address keyword
    if (!collecting) {
      for (const keyword of FIELD_KEYWORDS.address) {
        if (line.includes(keyword)) {
          collecting = true;
          // Add rest of this line after keyword
          const afterKeyword = lines[i].slice(line.indexOf(keyword) + keyword.length).trim();
          if (afterKeyword.length > 5) {
            addressLines.push(afterKeyword);
          }
          break;
        }
      }
    } else {
      // Stop if we hit another field keyword or empty line
      if (isFieldKeywordLine(line) || line.length === 0) {
        break;
      }
      addressLines.push(lines[i]);
    }
  }

  if (addressLines.length > 0) {
    return addressLines.join(', ').slice(0, 200);
  }

  // Fallback: look for pincode (6 digits)
  for (let i = 0; i < lines.length; i++) {
    const pincodeMatch = lines[i].match(/\b\d{6}\b/);
    if (pincodeMatch) {
      // Collect surrounding lines as address
      const start = Math.max(0, i - 2);
      const end = Math.min(lines.length, i + 2);
      return lines.slice(start, end + 1).join(', ').slice(0, 200);
    }
  }

  return '';
}

// Helper functions

function findDatePattern(text: string): string | null {
  // Common date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD.MM.YYYY
  const separators = ['/', '-', '.'];
  for (const sep of separators) {
    const pattern = new RegExp(`\\d{1,2}${sep}\\d{1,2}${sep}\\d{4}`);
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  // Month name format: DD Mon YYYY or Mon DD, YYYY
  const monthPattern = /\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/i;
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    return monthMatch[0];
  }

  return null;
}

function extract12DigitNumber(text: string): string | null {
  // Match 12 digits with optional spaces: 1234 5678 9012 or 123456789012
  const cleaned = text.replace(/\s/g, '');
  const match = cleaned.match(/\d{12}/);
  if (match) {
    // Return formatted as XXXX XXXX XXXX
    const digits = match[0];
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }
  return null;
}

function extractPanFormat(text: string): string | null {
  // PAN: 5 uppercase letters + 4 digits + 1 uppercase letter
  const cleaned = text.toUpperCase().replace(/\s/g, '');
  const match = cleaned.match(/[A-Z]{5}\d{4}[A-Z]/);
  return match ? match[0] : null;
}

function isLikelyName(text: string): boolean {
  if (!text || text.length < 3 || text.length > 60) return false;

  // Should be mostly letters with spaces
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < 2 || words.length > 5) return false;

  // Each word should be mostly alphabetic
  for (const word of words) {
    const alphaRatio = (word.match(/[a-zA-Z]/g) || []).length / word.length;
    if (alphaRatio < 0.7) return false;
  }

  return true;
}

function isLikelyDate(text: string): boolean {
  return findDatePattern(text) !== null;
}

function isLikelyPhone(text: string): boolean {
  const cleaned = text.replace(/\s/g, '');
  return /^\d{10}$/.test(cleaned);
}

function cleanFieldValue(value: string): string {
  return value
    .replace(/^[:.\-\s]+/, '') // Remove leading separators
    .replace(/[:.\-\s]+$/, '') // Remove trailing separators
    .replace(/\s+/g, ' ')      // Normalize spaces
    .trim();
}

function isNearAadhaarKeyword(lines: string[], index: number): boolean {
  const contextRange = 3;
  for (let i = Math.max(0, index - contextRange); i <= Math.min(lines.length - 1, index + contextRange); i++) {
    const lineLower = lines[i].toLowerCase();
    if (FIELD_KEYWORDS.aadhaarNumber.some((kw) => lineLower.includes(kw))) {
      return true;
    }
  }
  return false;
}

function isNearPanKeyword(lines: string[], index: number): boolean {
  const contextRange = 3;
  for (let i = Math.max(0, index - contextRange); i <= Math.min(lines.length - 1, index + contextRange); i++) {
    const lineLower = lines[i].toLowerCase();
    if (FIELD_KEYWORDS.panNumber.some((kw) => lineLower.includes(kw))) {
      return true;
    }
  }
  return false;
}

function isFieldKeywordLine(line: string): boolean {
  const allKeywords = Object.values(FIELD_KEYWORDS).flat();
  return allKeywords.some((kw) => line.includes(kw));
}
