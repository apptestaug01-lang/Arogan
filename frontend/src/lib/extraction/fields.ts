import type { ApplicationDraft, ApplicationDraftKey } from './types';

export interface FieldStrategy {
  // Context keywords that, when found near a match, raise confidence to "high".
  contextKeywords?: string[];
  // Patterns tried in order; first capture group (or full match) is the value.
  patterns: RegExp[];
  // Optional post-processing of the raw captured string (trim, normalise units…).
  transform?: (raw: string) => string;
}

export interface FieldDefinition {
  key: ApplicationDraftKey;
  label: string;
  // Vault categories most likely to contain this field, highest priority first.
  affinity: string[];
  // Tried in order; the first strategy that yields a value wins (per document).
  strategies: FieldStrategy[];
}

// Character class used to capture free-text company / person / description phrases.
// Dash is placed last so it is always a literal (no range ambiguity, no escaping).
const TXT = '[A-Za-z0-9 &.,()\'-]';

// One source of truth for what the application needs and where to find it.
// Each field declares its own extraction strategies so matching is exact-meaning
// rather than a generic "guess the whole form" pass.
export const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'companyName',
    label: 'Company name',
    affinity: ['KYC', 'Other Documents'],
    strategies: [
      {
        contextKeywords: ['company name', 'name of the company', 'borrower', 'm/s', 'applicant'],
        patterns: [
          new RegExp(`company\\s*name\\s*[ :-]\\s*(${TXT}*(?:Ltd|Limited|Private Limited|Pvt\\s*Ltd|LLP|Inc|Industries|Enterprises|Infra)${TXT}*)`, 'i'),
          new RegExp(`(${TXT}*(?:Private Limited|Pvt\\s*Ltd|Ltd|Limited|LLP)${TXT}*)`, 'i'),
        ],
        transform: (raw) => raw.replace(/\s+/g, ' ').trim(),
      },
    ],
  },
  {
    key: 'cin',
    label: 'CIN',
    affinity: ['KYC'],
    strategies: [
      {
        contextKeywords: ['cin', 'corporate identity number', 'registration number'],
        patterns: [/\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/],
      },
    ],
  },
  {
    key: 'industry',
    label: 'Industry',
    affinity: ['KYC', 'Financials'],
    strategies: [
      {
        contextKeywords: ['industry', 'sector', 'line of business'],
        patterns: [
          /(infrastructure)/i,
          /(manufactur\w*)/i,
          /(renewable\s*energy|solar|wind\s*energy)/i,
          /(it\/ites|information technology|software|ITES)/i,
        ],
        transform: (raw) => {
          const v = raw.toLowerCase();
          if (v.includes('infra')) return 'Infrastructure';
          if (v.includes('manufact')) return 'Manufacturing';
          if (v.includes('renew') || v.includes('solar') || v.includes('wind')) return 'Renewable Energy';
          if (v.includes('it') || v.includes('software') || v.includes('ites')) return 'IT/ITES';
          return raw;
        },
      },
    ],
  },
  {
    key: 'groupCompany',
    label: 'Group company',
    affinity: ['KYC', 'Other Documents'],
    strategies: [
      {
        contextKeywords: ['group', 'holding', 'parent company', 'promoter group'],
        patterns: [
          new RegExp(`group\\s*company\\s*[ :-]\\s*(${TXT}*(?:Ltd|Limited|Private Limited|Pvt\\s*Ltd)${TXT}*)`, 'i'),
          new RegExp(`(parent|holding)\\s*company\\s*[ :-]\\s*(${TXT}*)`, 'i'),
        ],
        transform: (raw) => raw.replace(/\s+/g, ' ').trim(),
      },
    ],
  },
  {
    key: 'signatory',
    label: 'Authorised signatory',
    affinity: ['KYC'],
    strategies: [
      {
        contextKeywords: ['authorised signatory', 'authorized signatory', 'signatory', 'name of director'],
        patterns: [
          /authori[sz]ed\s*signatory\s*[ :-]\s*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,3})/i,
          /signatory\s*[ :-]\s*([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,3})/i,
        ],
        transform: (raw) => raw.replace(/\s+/g, ' ').trim(),
      },
    ],
  },
  {
    key: 'designation',
    label: 'Designation',
    affinity: ['KYC'],
    strategies: [
      {
        contextKeywords: ['designation', 'capacity', 'title'],
        patterns: [
          /designation\s*[ :-]\s*([A-Za-z/ ]{2,40}?)(?:\n|$)/i,
          /\b(Managing Director|Director|Chief Financial Officer|CFO|MD|Whole-time Director)\b/i,
        ],
        transform: (raw) => raw.replace(/\s+/g, ' ').trim(),
      },
    ],
  },
  {
    key: 'loanAmount',
    label: 'Loan amount (₹ Cr)',
    affinity: ['Existing Sanction Letters', 'Financials'],
    strategies: [
      {
        contextKeywords: ['loan amount', 'sanction', 'facility', 'proposed', ' rupee', '₹'],
        patterns: [
          /(?:loan amount|sanction(?:ed)?(?:\s+loan)?|facility|proposed)\D{0,30}?(\d[\d,.]*)\s*(crore|cr\.?)/i,
          /(?:rs\.?|₹)\s*(\d[\d,.]*)\s*(crore|cr\.?)/i,
        ],
        transform: (raw) => raw.replace(/,/g, '').trim(),
      },
    ],
  },
  {
    key: 'productType',
    label: 'Product type',
    affinity: ['Existing Sanction Letters'],
    strategies: [
      {
        contextKeywords: ['product', 'facility', 'type of loan'],
        patterns: [
          /(term loan)/i,
          /(working capital)/i,
          /(project finance)/i,
          /\b(LC|letter of credit)\b/i,
          /\b(BG|bank guarantee)\b/i,
        ],
        transform: (raw) => {
          const v = raw.toLowerCase();
          if (v.includes('term')) return 'Term Loan';
          if (v.includes('working')) return 'Working Capital';
          if (v.includes('project')) return 'Project Finance';
          if (v.includes('lc') || v.includes('credit')) return 'LC/BG';
          if (v.includes('bg') || v.includes('guarantee')) return 'LC/BG';
          return raw;
        },
      },
    ],
  },
  {
    key: 'tenor',
    label: 'Tenor (years)',
    affinity: ['Existing Sanction Letters'],
    strategies: [
      {
        contextKeywords: ['tenor', 'tenure', 'period', 'repayment'],
        patterns: [/(?:tenor|tenure|period|repayment)\D{0,20}?(\d{1,2})\s*(years|months|yrs)/i],
        transform: (raw) => raw.trim(),
      },
    ],
  },
  {
    key: 'purpose',
    label: 'Purpose of loan',
    affinity: ['Existing Sanction Letters', 'Other Documents'],
    strategies: [
      {
        contextKeywords: ['purpose', 'for the purpose', 'utilised', 'proposed to be'],
        patterns: [
          new RegExp(`purpose\\s*of\\s*(?:the\\s*)?loan\\s*[ :-]\\s*(${TXT}{6,160})`, 'i'),
          new RegExp(`for\\s*the\\s*purpose\\s*of\\s*(${TXT}{6,160})`, 'i'),
        ],
        transform: (raw) => raw.replace(/\s+/g, ' ').trim(),
      },
    ],
  },
  {
    key: 'collateral',
    label: 'Collateral / security',
    affinity: ['Existing Sanction Letters', 'Property'],
    strategies: [
      {
        contextKeywords: ['collateral', 'security', 'mortgage', 'charge'],
        patterns: [
          new RegExp(`collateral\\s*(?:security)?\\s*[ :-]\\s*(${TXT}{6,200})`, 'i'),
          new RegExp(`(primary|collateral)\\s*security\\s*[ :-]\\s*(${TXT}{6,200})`, 'i'),
        ],
        transform: (raw) => raw.replace(/\s+/g, ' ').trim(),
      },
    ],
  },
  {
    key: 'turnover',
    label: 'Annual turnover (₹ Cr)',
    affinity: ['Financials'],
    strategies: [
      {
        contextKeywords: ['turnover', 'revenue', 'sales', 'topline'],
        patterns: [
          /(?:annual\s*)?turnover\D{0,20}?(\d[\d,.]*)\s*(crore|cr\.?)/i,
          /revenue\D{0,20}?(\d[\d,.]*)\s*(crore|cr\.?)/i,
        ],
        transform: (raw) => raw.replace(/,/g, '').trim(),
      },
    ],
  },
  {
    key: 'debt',
    label: 'Existing debt (₹ Cr)',
    affinity: ['Financials', 'Existing Sanction Letters'],
    strategies: [
      {
        contextKeywords: ['existing debt', 'outstanding', 'borrowings', 'liabilities', 'term loan'],
        patterns: [
          /(?:existing\s*)?debt\D{0,20}?(\d[\d,.]*)\s*(crore|cr\.?)/i,
          /total\s*borrowings\D{0,20}?(\d[\d,.]*)\s*(crore|cr\.?)/i,
        ],
        transform: (raw) => raw.replace(/,/g, '').trim(),
      },
    ],
  },
  {
    key: 'netWorth',
    label: 'Net worth (₹ Cr)',
    affinity: ['Financials'],
    strategies: [
      {
        contextKeywords: ['net worth', 'networth'],
        patterns: [/(?:net\s*worth)\D{0,20}?(\d[\d,.]*)\s*(crore|cr\.?)/i],
        transform: (raw) => raw.replace(/,/g, '').trim(),
      },
    ],
  },
];

export const FIELD_KEYS: ApplicationDraftKey[] = FIELD_DEFINITIONS.map((f) => f.key);

export type { ApplicationDraft, ApplicationDraftKey };
