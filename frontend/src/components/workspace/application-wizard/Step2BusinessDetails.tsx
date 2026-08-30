import * as React from 'react';
import { WizardInput, WizardSelect, WizardToggle } from './WizardField';
import type { UseWizardStateReturn } from '@/hooks/useWizardState';

interface Step2BusinessDetailsProps {
  wizard: Pick<UseWizardStateReturn, 'data' | 'setField' | 'constants' | 'errors'>;
}

export function Step2BusinessDetails({ wizard }: Step2BusinessDetailsProps) {
  const { data, setField, constants, errors } = wizard;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardInput
          label="Legal Company Name"
          required
          value={data.companyName}
          onChange={(v) => setField('companyName', v)}
          placeholder="e.g., ABC Infra Ltd."
          className="sm:col-span-2"
          error={errors.companyName}
        />
        <WizardSelect
          label="Business Type"
          required
          value={data.businessType}
          onChange={(v) => setField('businessType', v)}
          options={constants?.businessTypes || []}
          placeholder="Select business type"
          error={errors.businessType}
        />
        <WizardSelect
          label="Industry"
          required
          value={data.industry}
          onChange={(v) => setField('industry', v)}
          options={constants?.industries || []}
          placeholder="Select industry"
          error={errors.industry}
        />
        <WizardInput
          label="CIN"
          required
          value={data.cin}
          onChange={(v) => setField('cin', v)}
          placeholder="U12345MH2020PLC123456"
          error={errors.cin}
        />
        <WizardInput
          label="Authorised Signatory"
          required
          value={data.signatory}
          onChange={(v) => setField('signatory', v)}
          placeholder="Full name"
          error={errors.signatory}
        />
        <WizardInput
          label="Designation"
          required
          value={data.designation}
          onChange={(v) => setField('designation', v)}
          placeholder="Director / CFO / MD"
          error={errors.designation}
        />
        <WizardInput
          label="Group Company"
          value={data.groupCompany}
          onChange={(v) => setField('groupCompany', v)}
          placeholder="Parent / group name (optional)"
          className="sm:col-span-2"
        />
      </div>

      <WizardToggle
        checked={data.gstRegistered}
        onChange={(v) => setField('gstRegistered', v)}
        label="GST Registered"
      />

      {data.gstRegistered && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <WizardInput
            label="GSTIN"
            value={data.gstin}
            onChange={(v) => setField('gstin', v.toUpperCase())}
            placeholder="24XXXXX0123R1Z9"
            hint="15-character GST identification number"
            error={errors.gstin}
          />
          <WizardInput
            label="Company PAN"
            value={data.companyPan}
            onChange={(v) => setField('companyPan', v.toUpperCase())}
            placeholder="AABCA7890T"
            error={errors.companyPan}
          />
        </div>
      )}

      <WizardInput
        label="Date of Incorporation"
        type="date"
        value={data.dateOfIncorporation}
        onChange={(v) => setField('dateOfIncorporation', v)}
        error={errors.dateOfIncorporation}
      />
    </div>
  );
}
