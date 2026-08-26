export type ApplicationStatus = 'Reviewing' | 'Draft' | 'Verified' | 'Uploaded';

export interface Application {
  id: string;
  company: string;
  product: string;
  amount: string;
  status: ApplicationStatus;
}

export interface DocumentItem {
  id: string;
  name: string;
  meta: string;
  status: ApplicationStatus;
}

export interface Metric {
  label: string;
  value: string;
  hint: string;
}

export interface RequiredDoc {
  id: string;
  name: string;
  status: 'Complete' | 'Required';
}

export const dashboardMetrics: Metric[] = [
  { label: 'Active applications', value: '02', hint: 'One needs your attention' },
  { label: 'Documents uploaded', value: '18', hint: '3 awaiting review' },
  { label: 'Application completion', value: '72%', hint: 'LAP-2026-0184' },
  { label: 'Next action', value: '2 days', hint: 'Upload FY returns' },
];

export const applications: Application[] = [
  { id: 'LAP-2026-0184', company: 'ABC Infra Ltd.', product: 'Term loan', amount: '₹150 Cr', status: 'Reviewing' },
  { id: 'LAP-2026-0162', company: 'ABC Infra Ltd.', product: 'Working capital', amount: '₹75 Cr', status: 'Draft' },
];

export const documents: DocumentItem[] = [
  { id: 'doc-1', name: 'Audited financials FY 2025–26.pdf', meta: 'Financial statement · 3.4 MB', status: 'Verified' },
  { id: 'doc-2', name: 'Board resolution.pdf', meta: 'Corporate document · 840 KB', status: 'Reviewing' },
  { id: 'doc-3', name: 'GST returns Q1.xlsx', meta: 'Tax document · 1.2 MB', status: 'Uploaded' },
];

export const requiredDocs: RequiredDoc[] = [
  { id: 'req-1', name: 'Audited financials', status: 'Complete' },
  { id: 'req-2', name: 'Board resolution', status: 'Complete' },
  { id: 'req-3', name: 'GST returns', status: 'Required' },
  { id: 'req-4', name: 'Bank statements', status: 'Required' },
];

export type DocRequirement =
  | 'Mandatory'
  | 'Highly Recommended'
  | 'Conditional'
  | 'Required for Startups';

export interface MasterDocItem {
  id: string;
  name: string;
  requirement: DocRequirement;
}

export interface MasterDocSection {
  id: string;
  title: string;
  items: MasterDocItem[];
}

export const requiredDocumentsMaster: MasterDocSection[] = [
  {
    id: 'kyc',
    title: 'SECTION 1: KYC (Identity & Address)',
    items: [
      { id: 'kyc-pan', name: 'PAN Card (Individual)', requirement: 'Mandatory' },
      { id: 'kyc-aadhaar', name: 'Aadhaar Card', requirement: 'Mandatory' },
      {
        id: 'kyc-address',
        name: 'Voter ID / Passport / Driving License (Any 1)',
        requirement: 'Mandatory',
      },
      {
        id: 'kyc-bill',
        name: 'Latest Electricity / Phone Bill (Address Proof)',
        requirement: 'Mandatory',
      },
    ],
  },
  {
    id: 'registration',
    title: 'SECTION 2: Business Registration',
    items: [
      { id: 'reg-pan', name: 'Business PAN Card', requirement: 'Mandatory' },
      { id: 'reg-gst', name: 'GST Registration Certificate', requirement: 'Mandatory' },
      { id: 'reg-msme', name: 'MSME / Udyam Registration', requirement: 'Highly Recommended' },
      {
        id: 'reg-shop',
        name: 'Shop & Establishment Act License',
        requirement: 'Mandatory',
      },
      {
        id: 'reg-partnership',
        name: 'Partnership Deed (If Partnership)',
        requirement: 'Conditional',
      },
      {
        id: 'reg-moa',
        name: 'MoA & AoA / Incorporation Certificate (If Pvt Ltd/LLP)',
        requirement: 'Conditional',
      },
      {
        id: 'reg-industry',
        name: 'Industry-Specific License (e.g., FSSAI, Drug License)',
        requirement: 'Conditional',
      },
    ],
  },
  {
    id: 'financial',
    title: 'SECTION 3: Financial & Bank Records',
    items: [
      {
        id: 'fin-biz-itr',
        name: 'Business ITR (Last 2 Years)',
        requirement: 'Mandatory',
      },
      {
        id: 'fin-ind-itr',
        name: 'Individual ITR of Promoters (Last 2 Years)',
        requirement: 'Mandatory',
      },
      {
        id: 'fin-bs',
        name: 'Audited Balance Sheet (Last 3 Years)',
        requirement: 'Mandatory',
      },
      {
        id: 'fin-pl',
        name: 'Profit & Loss Statement (Last 3 Years)',
        requirement: 'Mandatory',
      },
      {
        id: 'fin-biz-bank',
        name: 'Business Bank Statements (Last 6 Months)',
        requirement: 'Mandatory',
      },
      {
        id: 'fin-pers-bank',
        name: 'Personal Bank Statements of Promoters (Last 6 Months)',
        requirement: 'Mandatory',
      },
      {
        id: 'fin-projected',
        name: 'Projected Financials (Next 3 Years)',
        requirement: 'Required for Startups',
      },
    ],
  },
  {
    id: 'collateral',
    title: 'SECTION 4: Collateral / Security (Only if applying for Secured Loan)',
    items: [
      { id: 'col-title', name: 'Property Title Deed', requirement: 'Conditional' },
      { id: 'col-encumbrance', name: 'Encumbrance Certificate', requirement: 'Conditional' },
      {
        id: 'col-tax',
        name: 'Property Tax Receipts (Last 2 Years)',
        requirement: 'Conditional',
      },
      {
        id: 'col-nodues',
        name: 'No-Dues Certificate from Previous Lenders',
        requirement: 'Conditional',
      },
    ],
  },
];

export interface LoanProduct {
  id: string;
  name: string;
  tagline: string;
  description: string;
  requiredDocuments: string[];
}

export const loanProducts: LoanProduct[] = [
  {
    id: 'term-loan',
    name: 'Term Loan',
    tagline: 'Capital expenditure & expansion',
    description: 'Medium- to long-tenor funding for plant, equipment, and business expansion.',
    requiredDocuments: [
      'Audited financials (last 2 years)',
      'Board resolution',
      'Project report / DPR',
      'GST returns',
      'Bank statements',
    ],
  },
  {
    id: 'working-capital',
    name: 'Working Capital',
    tagline: 'Cash-flow & operating needs',
    description: 'Revolving limits to manage day-to-day operations and short-term liabilities.',
    requiredDocuments: [
      'Audited financials',
      'GST returns (last 12 months)',
      'Bank statements',
      'Debt schedule',
    ],
  },
  {
    id: 'project-finance',
    name: 'Project Finance',
    tagline: 'Long-tenor project funding',
    description: 'Non-recourse funding secured by the cash flows of a specific project.',
    requiredDocuments: [
      'Project report / DPR',
      'Audited financials',
      'Board resolution',
      'Environment & statutory clearance',
      'Promoter KYC',
    ],
  },
  {
    id: 'lc-bg',
    name: 'LC / BG',
    tagline: 'Trade & statutory guarantees',
    description: 'Letters of credit and bank guarantees for trade and contractual obligations.',
    requiredDocuments: [
      'Application form',
      'Audited financials',
      'Bank statements',
      'KYC documents',
    ],
  },
];
