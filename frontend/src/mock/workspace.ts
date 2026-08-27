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

export interface DocFile {
  id: string;
  type: 'file';
  name: string;
  size: string;
  status: ApplicationStatus;
  modified: string;
}

export interface DocFolder {
  id: string;
  type: 'folder';
  name: string;
  children: DocNode[];
}

export type DocNode = DocFile | DocFolder;

export const documentTree: DocFolder = {
  id: 'root',
  type: 'folder',
  name: 'LAP-2026-0184',
  children: [
    {
      id: 'kyc',
      type: 'folder',
      name: 'KYC',
      children: [
        {
          id: 'kyc-company',
          type: 'folder',
          name: 'Company KYC',
          children: [
            { id: 'f1', type: 'file', name: 'AOA.pdf', size: '733 KB', status: 'Verified', modified: '31 Mar 2022' },
            { id: 'f2', type: 'file', name: 'Certificate of Incorporation.pdf', size: '504 KB', status: 'Verified', modified: '12 Jan 2022' },
            { id: 'f3', type: 'file', name: 'MOA.pdf', size: '925 KB', status: 'Verified', modified: '12 Jan 2022' },
            { id: 'f4', type: 'file', name: 'Shareholding pattern-31-03-2022.pdf', size: '421 KB', status: 'Uploaded', modified: '31 Mar 2022' },
            { id: 'f5', type: 'file', name: 'Udyog Aadhar.pdf', size: '305 KB', status: 'Uploaded', modified: '02 Feb 2022' },
          ],
        },
        {
          id: 'kyc-promoter',
          type: 'folder',
          name: 'Promoter or Director KYC',
          children: [
            { id: 'f6', type: 'file', name: 'Anil Aadhar card.pdf', size: '210 KB', status: 'Verified', modified: '10 Feb 2022' },
            { id: 'f7', type: 'file', name: 'Anil PAN CARD.pdf', size: '197 KB', status: 'Verified', modified: '10 Feb 2022' },
            { id: 'f8', type: 'file', name: 'Anil ITR 2022-23.pdf', size: '1.1 MB', status: 'Reviewing', modified: '15 Apr 2022' },
            { id: 'f9', type: 'file', name: 'Sujatha Aadhar.pdf', size: '207 KB', status: 'Verified', modified: '10 Feb 2022' },
            { id: 'f10', type: 'file', name: 'Sujatha PAN card.pdf', size: '554 KB', status: 'Uploaded', modified: '10 Feb 2022' },
          ],
        },
      ],
    },
    {
      id: 'financials',
      type: 'folder',
      name: 'Financials',
      children: [
        { id: 'f11', type: 'file', name: 'Financials 2019-20.pdf', size: '4.3 MB', status: 'Verified', modified: '20 Jun 2021' },
        { id: 'f12', type: 'file', name: 'Financials for 2020-21.pdf', size: '4.1 MB', status: 'Verified', modified: '18 Jul 2022' },
        { id: 'f13', type: 'file', name: 'Financials - Signed 21-22.pdf', size: '5.2 MB', status: 'Reviewing', modified: '30 Sep 2022' },
      ],
    },
    {
      id: 'bank-statements',
      type: 'folder',
      name: 'Bank Statements',
      children: [],
    },
    {
      id: 'sanction',
      type: 'folder',
      name: 'Existing Sanction Letters',
      children: [
        { id: 'f14', type: 'file', name: 'ICICI Credit Arrangement Letter.pdf', size: '509 KB', status: 'Verified', modified: '04 Aug 2022' },
        { id: 'f15', type: 'file', name: 'HDFC - OD.pdf', size: '26 KB', status: 'Verified', modified: '11 Mar 2022' },
        { id: 'f16', type: 'file', name: 'HDFC Renewal Sanction Letter.pdf', size: '2.3 MB', status: 'Uploaded', modified: '22 May 2022' },
        { id: 'f17', type: 'file', name: 'Standard Chartered Bank.pdf', size: '3.3 MB', status: 'Uploaded', modified: '19 Jun 2022' },
        { id: 'f18', type: 'file', name: 'Loan repayment schedules.pdf', size: '4.5 MB', status: 'Reviewing', modified: '01 Jul 2022' },
      ],
    },
    {
      id: 'other',
      type: 'folder',
      name: 'Other Documents',
      children: [
        { id: 'f19', type: 'file', name: 'Anil Net worth certificate.pdf', size: '256 KB', status: 'Verified', modified: '31 Mar 2022' },
        { id: 'f20', type: 'file', name: 'Sujatha Net worth.pdf', size: '259 KB', status: 'Uploaded', modified: '31 Mar 2022' },
        { id: 'f21', type: 'file', name: 'Top 5 Supplier and Debtors.pdf', size: '430 KB', status: 'Uploaded', modified: '05 Nov 2022' },
        { id: 'f22', type: 'file', name: 'Order book as on 10-10-2022.pdf', size: '481 KB', status: 'Reviewing', modified: '10 Oct 2022' },
      ],
    },
    {
      id: 'property',
      type: 'folder',
      name: 'Property',
      children: [
        { id: 'f23', type: 'file', name: 'Plan New Property.pdf', size: '238 KB', status: 'Verified', modified: '14 Feb 2022' },
        { id: 'f24', type: 'file', name: 'Kondapur Registration Documents.pdf', size: '5.6 MB', status: 'Uploaded', modified: '03 Mar 2022' },
        { id: 'f25', type: 'file', name: 'Property Tax Receipt.pdf', size: '26 KB', status: 'Verified', modified: '22 Apr 2022' },
      ],
    },
    {
      id: 'stock',
      type: 'folder',
      name: 'Stock Statement',
      children: [
        { id: 'f26', type: 'file', name: 'SCB Stock Statement Apr 22.pdf', size: '1.7 MB', status: 'Verified', modified: '30 Apr 2022' },
        { id: 'f27', type: 'file', name: 'Stock Statement for May 22.pdf', size: '1.6 MB', status: 'Verified', modified: '31 May 2022' },
        { id: 'f28', type: 'file', name: 'SCB Stock Statement Jun 22.pdf', size: '4.0 MB', status: 'Uploaded', modified: '30 Jun 2022' },
        { id: 'f29', type: 'file', name: 'Stock Statement for Aug-22.pdf', size: '1.6 MB', status: 'Reviewing', modified: '31 Aug 2022' },
        { id: 'f30', type: 'file', name: 'Stock Statement for Sep-22.pdf', size: '1.6 MB', status: 'Reviewing', modified: '30 Sep 2022' },
      ],
    },
  ],
};
