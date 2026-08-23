import * as React from 'react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
  password: string;
}

const strengthRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains uppercase', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Contains lowercase', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Contains number', test: (p: string) => /\d/.test(p) },
  { label: 'Contains special character', test: (p: string) => /[^A-Za-z\d]/.test(p) },
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = strengthRules.filter((rule) => rule.test(password)).length;
  const percentage = (strength / strengthRules.length) * 100;

  const getStrengthColor = (s: number): string => {
    if (s <= 1) return 'bg-danger-500';
    if (s <= 2) return 'bg-orange-500';
    if (s <= 3) return 'bg-amber-500';
    if (s <= 4) return 'bg-green-400';
    return 'bg-green-600';
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            getStrengthColor(strength),
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {password && (
        <div className="flex flex-col gap-1">
          {strengthRules.map((rule) => (
            <div
              key={rule.label}
              className={cn(
                'text-xs flex items-center gap-1',
                rule.test(password)
                  ? 'text-green-600'
                  : 'text-gray-400',
              )}
            >
              <span
                className={cn(
                  'w-1 h-1 rounded-full',
                  rule.test(password) ? 'bg-green-600' : 'bg-gray-300',
                )}
              />
              {rule.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
