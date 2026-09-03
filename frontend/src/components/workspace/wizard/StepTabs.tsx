import * as React from 'react';
import { useMemo } from 'react';
import type { ApplicationDraft } from '@/types/application';
import { FIELDS_BY_STEP, STEP_LABELS, WIZARD_FIELDS, type WizardStep } from './fieldRegistry';

interface Props {
  data: ApplicationDraft;
  extractedFields: Record<string, { value: string | number | boolean | string[] }>;
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

const ORDER: WizardStep[] = ['kyc', 'business', 'financials', 'loan'];

function countFilled(step: WizardStep, data: ApplicationDraft) {
  const fields = FIELDS_BY_STEP[step] ?? [];
  const required = fields.filter((f) => f.required);
  const filled = required.filter((f) => {
    const v = data[f.name];
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.length > 0;
    return v != null;
  });
  return { required: required.length, filled: filled.length };
}

export function StepTabs({ data, extractedFields, currentStep, onStepClick }: Props) {
  const coverage = useMemo(() => {
    const total = WIZARD_FIELDS.filter((f) => f.required).length;
    const filled = WIZARD_FIELDS.filter((f) => {
      if (!f.required) return false;
      const v = data[f.name];
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'number') return v !== 0;
      if (typeof v === 'boolean') return v;
      if (Array.isArray(v)) return v.length > 0;
      return v != null;
    }).length;
    return { total, filled };
  }, [data]);

  const extractedSet = useMemo(() => new Set(Object.keys(extractedFields)), [extractedFields]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ORDER.map((step) => {
          const { required, filled } = countFilled(step, data);
          const isCurrent = step === currentStep;
          const isComplete = filled === required;
          return (
            <button
              key={step}
              onClick={() => onStepClick(step)}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                isCurrent
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : isComplete
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
              }`}
            >
              <span>{STEP_LABELS[step]}</span>
              <span className={`rounded-full px-2 text-xs ${isComplete ? 'bg-emerald-200' : 'bg-gray-100'}`}>
                {filled}/{required}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Overall: {coverage.filled} / {coverage.total} required fields</span>
        <span>{extractedSet.size} fields auto-filled from documents</span>
      </div>
    </div>
  );
}
