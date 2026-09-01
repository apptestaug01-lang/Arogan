import { ocrTextExtractor } from '../modules/documentExtraction/ocrTextExtractor.js';

const sampleAadhaarText = `
GOVERNMENT OF INDIA
UNIQUE IDENTIFICATION AUTHORITY OF INDIA
Aadhaar

Name: Rajesh Kumar Sharma
DOB: 15/03/1985
Gender: Male
Aadhaar No: 1234 5678 9012
VID: 9876 5432 1098 7654
Address: 45, Main Road, Koramangala, Bangalore - 560034
Enrolment No: 12345/67890/12345
`;

const samplePanText = `
INCOME TAX DEPARTMENT
GOVT OF INDIA

Permanent Account Name
Name: RAJESH KUMAR SHARMA
Father's Name: RAMESH KUMAR SHARMA
Date of Birth: 15/03/1985
Permanent Account Number: ABCDE1234F
Generated on: 01/01/2024
`;

console.log('=== Aadhaar Card Extraction ===');
const aadhaarResult = ocrTextExtractor.extractFromText(sampleAadhaarText, 'aadhaar_card.pdf');
console.log(JSON.stringify(aadhaarResult, null, 2));

console.log('\n=== PAN Card Extraction ===');
const panResult = ocrTextExtractor.extractFromText(samplePanText, 'pan_card.pdf');
console.log(JSON.stringify(panResult, null, 2));
