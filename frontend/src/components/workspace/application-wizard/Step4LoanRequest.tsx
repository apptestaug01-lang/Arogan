import * as React from 'react';
import { WizardInput, WizardSelect, WizardTextarea } from './WizardField';
import type { UseWizardStateReturn } from '@/hooks/useWizardState';

interface Step4LoanRequestProps {
  wizard: Pick<UseWizardStateReturn, 'data' | 'setField' | 'constants' | 'errors'>;
}

export function Step4LoanRequest({ wizard }: Step4LoanRequestProps) {
  const { data, setField, errors } = wizard;

  const estEmi = React.useMemo(() => {
    const principal = parseFloat(data.loanAmount) || 0;
    const rate = parseFloat(data.interestRate) || 11.5;
    const years = parseInt(data.tenor) || 7;
    if (principal <= 0 || years <= 0) return null;
    const monthlyRate = rate / 100 / 12;
    const months = years * 12;
    const emi = (principal * 1e7 * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    return `~₹ ${(emi / 1e7).toFixed(1)} Cr/month`;
  }, [data.loanAmount, data.interestRate, data.tenor]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardInput
          label="Loan Amount (₹ Cr)"
          required
          type="number"
          min={50}
          max={500}
          value={data.loanAmount}
          onChange={(v) => setField('loanAmount', v)}
          placeholder="e.g., 150"
          hint="Min: ₹50 Cr, Max: ₹500 Cr"
          error={errors.loanAmount}
        />
        <WizardSelect
          label="Product Type"
          required
          value={data.productType}
          onChange={(v) => setField('productType', v)}
          options={wizard.constants?.productTypes || []}
          placeholder="Select product"
          error={errors.productType}
        />
        <WizardInput
          label="Tenor (Years)"
          required
          type="number"
          min={1}
          max={25}
          value={data.tenor}
          onChange={(v) => setField('tenor', v)}
          placeholder="e.g., 7"
          error={errors.tenor}
        />
        <WizardInput
          label="Interest Rate (Expected %)"
          value={data.interestRate}
          onChange={(v) => setField('interestRate', v)}
          placeholder="e.g., 11.5"
          step="0.1"
          error={errors.interestRate}
        />
      </div>

      <WizardTextarea
        label="Purpose of Loan"
        required
        value={data.purpose}
        onChange={(v) => setField('purpose', v)}
        placeholder="Describe the purpose of the loan"
        hint="Min 20 characters"
        error={errors.purpose}
      />

      <WizardTextarea
        label="Collateral / Security Offered"
        required
        value={data.collateral}
        onChange={(v) => setField('collateral', v)}
        placeholder="Describe primary and collateral security"
        hint="Primary and collateral security details"
        error={errors.collateral}
        minHeight="120px"
      />

      {estEmi && (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Est. EMI: {estEmi}
          </span>
        </div>
      )}
    </div>
  );
}
