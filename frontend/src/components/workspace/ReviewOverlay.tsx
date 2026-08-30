import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ApplicationDraft } from '@/lib/extraction';

export interface ReviewOverlayProps {
  open: boolean;
  data: ApplicationDraft;
  onClose: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

const formatCurrency = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  if (num >= 100) return `₹ ${num.toFixed(0)} Cr`;
  return `₹ ${num.toFixed(1)} Cr`;
};

const calculateEmi = (principal: string, rate: string, tenorYears: string): string => {
  const p = parseFloat(principal);
  const r = parseFloat(rate);
  const years = parseInt(tenorYears);
  if (!p || p <= 0 || !r || r <= 0 || !years || years <= 0) return '—';
  const monthlyRate = r / 100 / 12;
  const months = years * 12;
  const emi = (p * 1e7 * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  return `~₹ ${(emi / 1e7).toFixed(1)} Cr/month`;
};

export function ReviewOverlay({ open, data, onClose, onEdit, onConfirm, confirming }: ReviewOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-background shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Review Application</h2>
            <p className="text-sm text-muted-foreground">Please verify all details before submitting</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="space-y-6 p-6">
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Personal & KYC</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReviewItem label="Full Name" value={data.fullName} />
              <ReviewItem label="PAN" value={data.pan} />
              <ReviewItem label="Aadhaar" value={data.aadhaar} />
              <ReviewItem label="Email" value={data.email} full />
              <ReviewItem label="Mobile" value={data.mobile} />
              <ReviewItem label="Address" value={data.address} full />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Business Details</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReviewItem label="Legal Name" value={data.companyName} full />
              <ReviewItem label="CIN" value={data.cin} />
              <ReviewItem label="Business Type" value={data.businessType} />
              <ReviewItem label="Industry" value={data.industry} />
              <ReviewItem label="GST Registered" value={data.gstRegistered ? 'Yes' : 'No'} />
              {data.gstRegistered && <ReviewItem label="GSTIN" value={data.gstin} />}
              <ReviewItem label="Incorporation" value={data.dateOfIncorporation} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Financial Summary</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReviewItem label="ITR Turnover Y1" value={formatCurrency(data.turnoverY1)} />
              <ReviewItem label="ITR Turnover Y2" value={formatCurrency(data.turnoverY2)} />
              <ReviewItem label="Avg Monthly Balance" value={formatCurrency(data.avgMonthlyBalance)} />
              <ReviewItem label="Monthly EMI" value={formatCurrency(data.existingMonthlyEmi)} />
              <ReviewItem label="Net Worth" value={formatCurrency(data.netWorth)} />
              <ReviewItem label="Existing Debt" value={formatCurrency(data.debt)} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">Loan Request</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ReviewItem label="Loan Amount" value={formatCurrency(data.loanAmount)} />
              <ReviewItem label="Product" value={data.productType} />
              <ReviewItem label="Tenor" value={`${data.tenor} years`} />
              <ReviewItem label="Est. EMI" value={calculateEmi(data.loanAmount, data.interestRate, data.tenor)} />
              <ReviewItem label="Purpose" value={data.purpose} full />
              <ReviewItem label="Collateral" value={data.collateral} full />
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-4">
          <Button variant="outline" onClick={onEdit}>
            ← Edit
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Submitting…' : 'Confirm & Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border bg-muted/50 p-3', full && 'sm:col-span-2')}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value || '—'}</div>
    </div>
  );
}
