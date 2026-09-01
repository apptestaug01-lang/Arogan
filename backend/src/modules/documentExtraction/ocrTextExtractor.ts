export interface PersonExtraction {
  name: string;
  aadhaar_number?: string;
  vid?: string;
  pan_number?: string;
  date_of_birth?: string;
  gender?: string;
  father_name?: string;
  enrolment_number?: string;
  generation_date?: string;
  issue_date?: string;
  address?: string;
}

export interface DocumentExtraction {
  filename: string;
  document_type: 'Aadhaar' | 'PAN';
  person: PersonExtraction;
}

export interface ExtractionResult {
  documents: DocumentExtraction[];
}

export class OcrTextExtractor {
  extractFromText(ocrText: string, filename: string): ExtractionResult {
    const documents: DocumentExtraction[] = [];

    if (this.isAadhaarCard(ocrText)) {
      documents.push({
        filename,
        document_type: 'Aadhaar',
        person: this.extractAadhaarFields(ocrText),
      });
    } else if (this.isPanCard(ocrText)) {
      documents.push({
        filename,
        document_type: 'PAN',
        person: this.extractPanFields(ocrText),
      });
    }

    return { documents };
  }

  private isAadhaarCard(text: string): boolean {
    const lowerText = text.toLowerCase();
    return (
      /aadhaar/.test(text) ||
      /unique identification/.test(lowerText) ||
      /uidai/.test(lowerText) ||
      /आधार/.test(text) ||
      /enrolment\s*no/i.test(text) ||
      /\d{4}\s*\d{4}\s*\d{4}/.test(text)
    );
  }

  private isPanCard(text: string): boolean {
    const lowerText = text.toLowerCase();
    return (
      /income\s*tax\s*department/.test(lowerText) ||
      /permanent\s*account\s*number/.test(lowerText) ||
      /[A-Z]{5}[0-9]{4}[A-Z]/.test(text) ||
      /pan\s*card/.test(lowerText)
    );
  }

  private extractAadhaarFields(text: string): PersonExtraction {
    const person: PersonExtraction = { name: '' };

    const aadhaarMatch = text.match(/(\d{4}\s*\d{4}\s*\d{4})/);
    if (aadhaarMatch) {
      person.aadhaar_number = aadhaarMatch[1].replace(/\s/g, '');
    }

    const vidMatch = text.match(/VID[:\s]*(\d{4}\s*\d{4}\s*\d{4}\s*\d{4})/i);
    if (vidMatch) {
      person.vid = vidMatch[1].replace(/\s/g, '');
    }

    const namePatterns = [
      /(?:Name|नाम)[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)+)/i,
      /(?:To\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:\n|$)/,
      /Government\s+of\s+India\s*\n+([A-Za-z]+(?:\s+[A-Za-z]+)+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 3 && !/india|government|unique|authority/i.test(name)) {
          person.name = name;
          break;
        }
      }
    }

    const dobPatterns = [
      /(?:DOB|Date\s*of\s*Birth|जन्म\s*तिथि)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      /(?:Year\s*of\s*Birth|YOB)[:\s]+(\d{4})/i,
      /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
    ];

    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match) {
        person.date_of_birth = match[1];
        break;
      }
    }

    const genderPatterns = [
      /(Male|Female|Transgender)/i,
      /(?:Gender|लिंग)[:\s]+(Male|Female)/i,
    ];

    for (const pattern of genderPatterns) {
      const match = text.match(pattern);
      if (match) {
        person.gender = match[1];
        break;
      }
    }

    const fatherMatch = text.match(/Father[:\s]+([A-Za-z]+(?:\s+[A-Za-z]+)+)/i);
    if (fatherMatch) {
      person.father_name = fatherMatch[1].trim();
    }

    const enrolmentMatch = text.match(/Enrolment\s*No[:\s]+([\d\/]+)/i);
    if (enrolmentMatch) {
      person.enrolment_number = enrolmentMatch[1];
    }

    const addressPatterns = [
      /(?:Address|पता)[:\s]+([\s\S]+?)(?:\n\s*\n|\d{6}|$)/i,
      /([A-Za-z0-9\s,.-]+(?:Road|Street|Nagar|Colony|Lane|Marg)[A-Za-z0-9\s,.-]*\d{6})/i,
    ];

    for (const pattern of addressPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const address = match[1].replace(/\s+/g, ' ').trim();
        if (address.length > 15) {
          person.address = address;
          break;
        }
      }
    }

    return person;
  }

  private extractPanFields(text: string): PersonExtraction {
    const person: PersonExtraction = { name: '' };

    const panMatch = text.match(/([A-Z]{5}[0-9]{4}[A-Z])/);
    if (panMatch) {
      person.pan_number = panMatch[1];
    }

    const namePatterns = [
      /(?:Name\s*\n+|Name[:\s]+)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:Father'?s?\s*Name|Name)[:\s\n]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*(?:\n|$)/,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length > 3 && !/india|income|department|signature|authority/i.test(name)) {
          person.name = name;
          break;
        }
      }
    }

    const dobPatterns = [
      /(?:Date\s*of\s*Birth|DOB|Birth)[:\s\n]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/,
    ];

    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match) {
        person.date_of_birth = match[1];
        break;
      }
    }

    const fatherMatch = text.match(/Father'?s?\s*Name[:\s\n]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    if (fatherMatch) {
      person.father_name = fatherMatch[1].trim();
    }

    const generationMatch = text.match(/Generated\s*on[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
    if (generationMatch) {
      person.generation_date = generationMatch[1];
    }

    const issueMatch = text.match(/Issue\s*Date[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
    if (issueMatch) {
      person.issue_date = issueMatch[1];
    }

    return person;
  }
}

export const ocrTextExtractor = new OcrTextExtractor();
