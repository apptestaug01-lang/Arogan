import * as React from 'react';
import { useMemo } from 'react';
import type { ApplicationDraft } from '@/types/application';
import { FIELDS_BY_STEP, validateStep, STEP_LABELS } from './fieldRegistry';
import { renderStep } from './WizardField';

export type WizardStep = 'kyc' | 'business' | 'financials' | 'loan';

interface Props {
  step: WizardStep;
  data: ApplicationDraft;
  errors: Record<string, string | string[]>;
  extractedFields: Record<string, { value: string | number | boolean | string[] }>;
  onChange: <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => void;
  onValidate?: (step: WizardStep) => Record<string, string>;
}

export function StepView({ step, data, errors, extractedFields, onChange, onValidate: _onValidate }: Props) {
  const defs = useMemo(() => FIELDS_BY_STEP[step] ?? [], [step]);
  const required = defs.filter((d) => d.required);
  const filled = required.filter((d) => {
    const v = data[d.name];
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.length > 0;
    return v != null;
  });
  const missing = required.filter((d) => !filled.includes(d));
  const stepErrors = validateStep(step, data);
  const localErrorCount = Object.keys(stepErrors).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{STEP_LABELS[step]}</h2>
        <div className="text-xs text-gray-500">
          {filled.length} of {required.length} required fields filled
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-medium">Still required:</p>
          <ul className="ml-4 list-disc">
            {missing.map((d) => (
              <li key={d.name}>{d.label}</li>
            ))}
          </ul>
        </div>
      )}

      {renderStep(step, data, errors, onChange, extractedFields, FIELDS_BY_STEP)}

      {localErrorCount > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Please fix {localErrorCount} validation {localErrorCount === 1 ? 'issue' : 'issues'} before saving.
        </div>
      )}
    </div>
  );
}
