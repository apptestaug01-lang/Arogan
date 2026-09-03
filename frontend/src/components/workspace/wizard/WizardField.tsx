import * as React from 'react';
import type { FieldDef } from './fieldRegistry';
import type { ApplicationDraft } from '@/types/application';

interface BaseProps {
  def: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  autoFilled?: boolean;
}

function AutoFilledBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      ✓ Auto-filled
    </span>
  );
}

function Label({ def, autoFilled }: { def: FieldDef; autoFilled?: boolean }) {
  return (
    <label className="text-sm font-medium text-gray-800" htmlFor={def.name}>
      {def.label}
      {def.required && <span className="ml-0.5 text-red-500">*</span>}
      {autoFilled && <AutoFilledBadge />}
    </label>
  );
}

function Help({ def }: { def: FieldDef }) {
  if (!def.helpText) return null;
  return <p className="mt-0.5 text-xs text-gray-500">{def.helpText}</p>;
}

function ErrorMsg({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-0.5 text-xs text-red-500">{error}</p>;
}

function TextField({ def, value, onChange, error, autoFilled, type = 'text' }: BaseProps & { type?: string }) {
  return (
    <div>
      <Label def={def} autoFilled={autoFilled} />
      <Help def={def} />
      <input
        id={def.name}
        type={type}
        className={`input mt-1 w-full ${autoFilled ? 'border-emerald-300 bg-emerald-50/50' : ''} ${error ? 'border-red-400' : ''}`}
        value={(value as string | number | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        required={def.required}
      />
      <ErrorMsg error={error} />
    </div>
  );
}

function TextareaField({ def, value, onChange, error, autoFilled }: BaseProps) {
  return (
    <div>
      <Label def={def} autoFilled={autoFilled} />
      <Help def={def} />
      <textarea
        id={def.name}
        className={`input mt-1 w-full ${autoFilled ? 'border-emerald-300 bg-emerald-50/50' : ''} ${error ? 'border-red-400' : ''}`}
        rows={def.rows ?? 3}
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        required={def.required}
      />
      {def.minLength && (
        <p className="mt-0.5 text-xs text-gray-400">
          {((value as string) ?? '').length} / {def.minLength} characters minimum
        </p>
      )}
      <ErrorMsg error={error} />
    </div>
  );
}

function NumberField({ def, value, onChange, error, autoFilled }: BaseProps) {
  return (
    <TextField
      def={def}
      value={value}
      onChange={(v) => onChange(v === '' ? '' : Number(v))}
      error={error}
      autoFilled={autoFilled}
      type="number"
    />
  );
}

function SelectField({ def, value, onChange, error, autoFilled }: BaseProps) {
  return (
    <div>
      <Label def={def} autoFilled={autoFilled} />
      <Help def={def} />
      <select
        id={def.name}
        className={`input mt-1 w-full ${autoFilled ? 'border-emerald-300 bg-emerald-50/50' : ''} ${error ? 'border-red-400' : ''}`}
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={def.required}
      >
        <option value="">Select...</option>
        {(def.options ?? []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ErrorMsg error={error} />
    </div>
  );
}

function MultiSelectField({ def, value, onChange, error, autoFilled }: BaseProps) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const toggle = (opt: string) => {
    if (arr.includes(opt)) onChange(arr.filter((v) => v !== opt));
    else onChange([...arr, opt]);
  };
  return (
    <div>
      <Label def={def} autoFilled={autoFilled} />
      <Help def={def} />
      <div className={`mt-1 flex flex-wrap gap-2 ${error ? 'rounded border border-red-400 p-2' : ''}`}>
        {(def.options ?? []).map((opt) => {
          const selected = arr.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-primary-300'
              }`}
            >
              {selected ? '✓ ' : ''}{opt}
            </button>
          );
        })}
      </div>
      <ErrorMsg error={error} />
    </div>
  );
}

function BooleanField({ def, value, onChange, error, autoFilled }: BaseProps) {
  const boolVal = Boolean(value);
  return (
    <div>
      <Label def={def} autoFilled={autoFilled} />
      <Help def={def} />
      <button
        type="button"
        role="switch"
        aria-checked={boolVal}
        onClick={() => onChange(!boolVal)}
        className={`mt-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          boolVal ? 'bg-primary-500' : 'bg-gray-300'
        } ${error ? 'ring-2 ring-red-400' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            boolVal ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="ml-2 text-sm text-gray-700">{boolVal ? 'Yes' : 'No'}</span>
      <ErrorMsg error={error} />
    </div>
  );
}

export function WizardField(props: BaseProps) {
  switch (props.def.type) {
    case 'text':
      return <TextField {...props} />;
    case 'email':
      return <TextField {...props} type="email" />;
    case 'tel':
      return <TextField {...props} type="tel" />;
    case 'date':
      return <TextField {...props} type="date" />;
    case 'number':
      return <NumberField {...props} />;
    case 'textarea':
      return <TextareaField {...props} />;
    case 'select':
      return <SelectField {...props} />;
    case 'multiselect':
      return <MultiSelectField {...props} />;
    case 'boolean':
      return <BooleanField {...props} />;
    default:
      return null;
  }
}

export function renderStep(
  step: 'kyc' | 'business' | 'financials' | 'loan',
  data: ApplicationDraft,
  errors: Record<string, string | string[]>,
  onChange: <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => void,
  extractedFields: Record<string, { value: string | number | boolean | string[] }>,
  FIELDS_BY_STEP: Record<string, import('./fieldRegistry').FieldDef[]>,
) {
  const defs = FIELDS_BY_STEP[step] ?? [];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {defs.map((def) => {
        const fieldErrors = errors[def.name];
        const errorMsg = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
        return (
          <div key={def.name} className={def.type === 'textarea' ? 'md:col-span-2' : ''}>
            <WizardField
              def={def}
              value={data[def.name]}
              onChange={(v) => onChange(def.name, v as ApplicationDraft[typeof def.name])}
              error={errorMsg}
              autoFilled={!!extractedFields[def.name]}
            />
          </div>
        );
      })}
    </div>
  );
}
