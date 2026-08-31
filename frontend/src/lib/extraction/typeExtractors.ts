import type { ApplicationDraftKey } from './types';

export interface ExtractedFieldValue {
  value: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

export type ExtractedFields = Partial<Record<ApplicationDraftKey, ExtractedFieldValue>>;

function panFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch) {
    fields.pan = { value: panMatch[1], confidence: 'high', source: 'pan_document' };
  }
  return fields;
}

function aadhaarFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const aadhaarMatch = text.match(/\b([0-9]{4}\s?[0-9]{4}\s?[0-9]{4})\b/);
  if (aadhaarMatch) {
    fields.aadhaar = { value: aadhaarMatch[1].replace(/\s/g, ' '), confidence: 'high', source: 'aadhaar_document' };
  }
  return fields;
}

function gstFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1})\b/);
  if (gstinMatch) {
    fields.gstin = { value: gstinMatch[1], confidence: 'high', source: 'gst_document' };
  }

  const legalNameMatch = text.match(/legal\s*name\s*[ :-]\s*([A-Za-z0-9 &.,()'-]{3,100})/i);
  if (legalNameMatch) {
    fields.companyName = { value: legalNameMatch[1].trim(), confidence: 'high', source: 'gst_document' };
  }

  const businessTypeMatch = text.match(/(?:business\s*type|type\s*of\s*business|constitution)\s*[ :-]\s*(Private Limited|Public Limited|LLP|Proprietorship|Partnership)/i);
  if (businessTypeMatch) {
    fields.businessType = { value: businessTypeMatch[1], confidence: 'high', source: 'gst_document' };
  }

  return fields;
}

function itrFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  const turnoverMatches = text.matchAll(/(?:annual\s*)?turnover\D{0,20}?(\d[\d,.]*)\s*(crore|cr\.?)/gi);
  const turnovers: { value: string; confidence: string }[] = [];
  for (const match of turnoverMatches) {
    turnovers.push({ value: match[1].replace(/,/g, ''), confidence: 'medium' });
  }

  if (turnovers.length >= 2) {
    fields.turnoverY1 = { value: turnovers[0].value, confidence: 'medium', source: 'itr_document' };
    fields.turnoverY2 = { value: turnovers[1].value, confidence: 'medium', source: 'itr_document' };
  } else if (turnovers.length === 1) {
    fields.turnoverY1 = { value: turnovers[0].value, confidence: 'medium', source: 'itr_document' };
  }

  return fields;
}

function bankStatementFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  const balanceMatch = text.match(/(?:average\s*monthly\s*balance|avg\s*balance|amb)\s*[ :-]\s*[₹]?\s*([\d,]+(?:\.\d+)?)/i);
  if (balanceMatch) {
    fields.avgMonthlyBalance = { value: balanceMatch[1].replace(/,/g, ''), confidence: 'medium', source: 'bank_statement' };
  }

  const emiMatch = text.match(/(?:existing\s*monthly\s*emi|current\s*emi|monthly\s*emi)\s*[ :-]\s*[₹]?\s*([\d,]+(?:\.\d+)?)/i);
  if (emiMatch) {
    fields.existingMonthlyEmi = { value: emiMatch[1].replace(/,/g, ''), confidence: 'medium', source: 'bank_statement' };
  }

  const creditsMatch = text.match(/(?:average\s*monthly\s*credits|avg\s*credits|monthly\s*credits)\s*[ :-]\s*[₹]?\s*([\d,]+(?:\.\d+)?)/i);
  if (creditsMatch) {
    fields.avgMonthlyCredits = { value: creditsMatch[1].replace(/,/g, ''), confidence: 'medium', source: 'bank_statement' };
  }

  return fields;
}

function companyPanFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch) {
    fields.companyPan = { value: panMatch[1], confidence: 'high', source: 'company_pan_document' };
  }
  return fields;
}

function businessProofFromText(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  const cinMatch = text.match(/\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/);
  if (cinMatch) {
    fields.cin = { value: cinMatch[1], confidence: 'high', source: 'business_proof' };
  }

  const companyNameMatch = text.match(/(?:company\s*name|name\s*of\s*company|legal\s*name)\s*[ :-]\s*([A-Za-z0-9 &.,()'-]{3,100})/i);
  if (companyNameMatch) {
    fields.companyName = { value: companyNameMatch[1].trim(), confidence: 'high', source: 'business_proof' };
  }

  const signatoryMatch = text.match(/(?:authorised\s*signatory|authorized\s*signatory|signatory)\s*[ :-]\s*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,3})/i);
  if (signatoryMatch) {
    fields.signatory = { value: signatoryMatch[1].trim(), confidence: 'medium', source: 'business_proof' };
  }

  const designationMatch = text.match(/(?:designation|capacity|title)\s*[ :-]\s*([A-Za-z/ ]{2,40}?)(?:\n|$)/i);
  if (designationMatch) {
    fields.designation = { value: designationMatch[1].trim(), confidence: 'medium', source: 'business_proof' };
  }

  return fields;
}

export function extractByDocumentType(docType: string, text: string): ExtractedFields {
  switch (docType) {
    case 'pan':
      return panFromText(text);
    case 'aadhaar':
      return aadhaarFromText(text);
    case 'gst':
      return gstFromText(text);
    case 'itr':
      return itrFromText(text);
    case 'bank_statement':
      return bankStatementFromText(text);
    case 'company_pan':
      return companyPanFromText(text);
    case 'business_proof':
      return businessProofFromText(text);
    default:
      return {};
  }
}
