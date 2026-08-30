import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export function ProgressStepper({ currentStep, totalSteps, labels }: ProgressStepperProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 px-4">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, idx) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300',
                step === currentStep && 'bg-primary text-primary-foreground shadow-md',
                step < currentStep && 'bg-success text-success-foreground',
                step > currentStep && 'bg-muted text-muted-foreground border border-border',
              )}
            >
              {step < currentStep ? '✓' : step}
            </div>
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap transition-colors duration-300',
                step === currentStep && 'text-primary',
                step < currentStep && 'text-success',
                step > currentStep && 'text-muted-foreground',
              )}
            >
              {labels[idx]}
            </span>
          </div>
          {step < totalSteps && (
            <div className="mx-2 mb-6 h-0.5 w-12 rounded-full bg-border transition-colors duration-300 sm:mx-4 sm:w-16">
              <div
                className={cn(
                  'h-full rounded-full bg-success transition-all duration-300',
                  step < currentStep ? 'w-full' : 'w-0',
                )}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
