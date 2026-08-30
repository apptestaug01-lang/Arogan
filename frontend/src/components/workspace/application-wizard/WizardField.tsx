import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface WizardFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function WizardField({ label, required, error, hint, children, className }: WizardFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface WizardInputProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
}

export function WizardInput({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  placeholder,
  type = 'text',
  min,
  max,
  step,
  className,
}: WizardInputProps) {
  return (
    <WizardField label={label} required={required} error={error} hint={hint} className={className}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
      />
    </WizardField>
  );
}

interface WizardSelectProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function WizardSelect({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  options,
  placeholder,
  className,
}: WizardSelectProps) {
  return (
    <WizardField label={label} required={required} error={error} hint={hint} className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full rounded-md border border-input bg-background px-3 text-sm',
          error && 'border-destructive',
        )}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </WizardField>
  );
}

interface WizardTextareaProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export function WizardTextarea({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  placeholder,
  minHeight = '88px',
  className,
}: WizardTextareaProps) {
  return (
    <WizardField label={label} required={required} error={error} hint={hint} className={className}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
          'resize-y',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
        style={{ minHeight }}
      />
    </WizardField>
  );
}

interface WizardToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function WizardToggle({ checked, onChange, label }: WizardToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3 transition-colors hover:bg-muted"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <div
          className={cn(
            'absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </div>
    </button>
  );
}
