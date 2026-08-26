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
