import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionRow } from '@/components/workspace/SectionRow';
import { useToast } from '@/components/workspace/ToastProvider';
import { cn } from '@/lib/utils';

interface FormState {
  companyName: string;
  cin: string;
  industry: string;
  groupCompany: string;
  signatory: string;
  designation: string;
  loanAmount: string;
  productType: string;
  tenor: string;
  purpose: string;
  collateral: string;
  turnover: string;
  debt: string;
  netWorth: string;
}

const initial: FormState = {
  companyName: '',
  cin: '',
  industry: '',
  groupCompany: '',
  signatory: '',
  designation: '',
  loanAmount: '',
  productType: '',
  tenor: '',
  purpose: '',
  collateral: '',
  turnover: '',
  debt: '',
  netWorth: '',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({
  title,
  description,
  id,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  id: string;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between rounded-t-xl px-6 py-4 text-left"
      >
        <span>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
      </button>
      {open && <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</CardContent>}
    </Card>
  );
}

export default function NewApplicationView() {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = React.useState<FormState>(initial);
  const [saved, setSaved] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    borrower: true,
    loan: true,
    financial: true,
    declarations: true,
  });

  const set =
    (key: keyof FormState) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    toast('Application saved as a draft', 'success');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">
          Loan workspace / Applications / New application
        </p>
        <h1 className="page-title">New Loan Application</h1>
        <p className="page-sub">
          Complete the application details, then upload supporting documents from the
          Document upload section.
        </p>
      </div>

      {saved && (
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-700">
          Application saved as a draft.
        </div>
      )}

      <Section
        id="borrower"
        title="1. Borrower details"
        description="Company and authorised-signatory information"
        open={open.borrower}
        onToggle={toggle}
      >
        <Field label="Company name *">
          <Input required placeholder="e.g., ABC Infra Ltd." value={form.companyName} onChange={set('companyName')} />
        </Field>
        <Field label="CIN *">
          <Input required placeholder="U12345MH2020PLC123456" value={form.cin} onChange={set('cin')} />
        </Field>
        <Field label="Industry *">
          <select required className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.industry} onChange={set('industry')}>
            <option value="">Select industry</option>
            <option>Infrastructure</option>
            <option>Manufacturing</option>
            <option>Renewable Energy</option>
            <option>IT/ITES</option>
          </select>
        </Field>
        <Field label="Group company">
          <Input placeholder="Parent / group name" value={form.groupCompany} onChange={set('groupCompany')} />
        </Field>
        <Field label="Authorised signatory *">
          <Input required placeholder="Full name" value={form.signatory} onChange={set('signatory')} />
        </Field>
        <Field label="Designation *">
          <Input required placeholder="Director / CFO / MD" value={form.designation} onChange={set('designation')} />
        </Field>
      </Section>

      <Section
        id="loan"
        title="2. Loan request details"
        description="Requested facility, tenor, and purpose"
        open={open.loan}
        onToggle={toggle}
      >
        <Field label="Loan amount (₹ Cr) *">
          <Input required type="number" min={50} placeholder="e.g., 150" value={form.loanAmount} onChange={set('loanAmount')} />
        </Field>
        <Field label="Product type *">
          <select required className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.productType} onChange={set('productType')}>
            <option value="">Select product</option>
            <option>Term Loan</option>
            <option>Working Capital</option>
            <option>Project Finance</option>
            <option>LC/BG</option>
          </select>
        </Field>
        <Field label="Tenor (years) *">
          <Input required type="number" min={1} max={25} placeholder="e.g., 7" value={form.tenor} onChange={set('tenor')} />
        </Field>
        <Field label="Purpose of loan *">
          <Input required placeholder="e.g., Plant expansion" value={form.purpose} onChange={set('purpose')} />
        </Field>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-sm font-medium text-gray-700">Collateral / security offered *</Label>
          <textarea
            required
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Describe primary and collateral security"
            value={form.collateral}
            onChange={set('collateral')}
          />
        </div>
      </Section>

      <Section
        id="financial"
        title="3. Financial snapshot"
        description="Key financials for credit assessment"
        open={open.financial}
        onToggle={toggle}
      >
        <Field label="Annual turnover (₹ Cr)">
          <Input type="number" placeholder="e.g., 320" value={form.turnover} onChange={set('turnover')} />
        </Field>
        <Field label="Existing debt (₹ Cr)">
          <Input type="number" placeholder="e.g., 90" value={form.debt} onChange={set('debt')} />
        </Field>
        <Field label="Net worth (₹ Cr)">
          <Input type="number" placeholder="e.g., 140" value={form.netWorth} onChange={set('netWorth')} />
        </Field>
      </Section>

      <Section
        id="declarations"
        title="4. Required declarations"
        description="Authorisation, storage, and credit verification consents"
        open={open.declarations}
        onToggle={toggle}
      >
        <SectionRow title="Authorisation">
          <span className="text-xs font-medium text-muted-foreground">Consent required</span>
        </SectionRow>
        <SectionRow title="Storage &amp; processing">
          <span className="text-xs font-medium text-muted-foreground">Consent required</span>
        </SectionRow>
        <SectionRow title="Credit verification">
          <span className="text-xs font-medium text-muted-foreground">Consent required</span>
        </SectionRow>
      </Section>

      <div className="flex gap-3">
        <Button type="submit">Save as draft</Button>
        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/applications')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
