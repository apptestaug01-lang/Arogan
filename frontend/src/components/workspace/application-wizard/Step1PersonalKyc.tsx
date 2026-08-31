import * as React from 'react';
import { Button } from '@/components/ui/button';
import { WizardInput, WizardTextarea } from './WizardField';
import type { UseWizardStateReturn } from '@/hooks/useWizardState';

interface Step1PersonalKycProps {
  wizard: Pick<UseWizardStateReturn, 'data' | 'setField' | 'errors'>;
  onAutoFill?: () => void;
}

export function Step1PersonalKyc({ wizard, onAutoFill }: Step1PersonalKycProps) {
  const { data, setField, errors } = wizard;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Personal & KYC</h3>
        <Button size="sm" variant="outline" onClick={onAutoFill}>
          Auto-fill this step
        </Button>
      </div>

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
