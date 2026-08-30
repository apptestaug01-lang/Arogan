import * as React from 'react';
import { ApplicationAutoFill } from '@/components/workspace/ApplicationAutoFill';
import { WizardInput, WizardTextarea } from './WizardField';
import type { UseWizardStateReturn } from '@/hooks/useWizardState';
import type { ApplicationDraft } from '@/lib/extraction';

interface Step1PersonalKycProps {
  wizard: Pick<UseWizardStateReturn, 'data' | 'setField' | 'errors'>;
}

export function Step1PersonalKyc({ wizard }: Step1PersonalKycProps) {
  const { data, setField, errors } = wizard;

  return (
    <div className="space-y-6">
      <ApplicationAutoFill
        onApply={(values) => {
          Object.entries(values).forEach(([key, value]) => {
            if (key in data) setField(key as keyof ApplicationDraft, value as ApplicationDraft[keyof ApplicationDraft]);
          });
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WizardInput
          label="Full Name"
          required
          value={data.fullName}
          onChange={(v) => setField('fullName', v)}
          placeholder="e.g., Sameer Khan"
          error={errors.fullName}
        />
        <WizardInput
          label="PAN"
          required
          value={data.pan}
          onChange={(v) => setField('pan', v.toUpperCase())}
          placeholder="ABCDE1234F"
          hint="Format: 5 letters, 4 digits, 1 letter"
          error={errors.pan}
        />
        <WizardInput
          label="Aadhaar Number"
          required
          value={data.aadhaar}
          onChange={(v) => setField('aadhaar', v)}
          placeholder="XXXX XXXX XXXX"
          hint="12-digit Aadhaar number"
          error={errors.aadhaar}
        />
        <WizardInput
          label="Email"
          required
          type="email"
          value={data.email}
          onChange={(v) => setField('email', v)}
          placeholder="you@example.com"
          error={errors.email}
        />
        <WizardInput
          label="Mobile Number"
          required
          value={data.mobile}
          onChange={(v) => setField('mobile', v)}
          placeholder="+91 98765 43210"
          error={errors.mobile}
        />
        <WizardTextarea
          label="Address"
          required
          value={data.address}
          onChange={(v) => setField('address', v)}
          placeholder="Full residential address"
          error={errors.address}
        />
      </div>
    </div>
  );
}
