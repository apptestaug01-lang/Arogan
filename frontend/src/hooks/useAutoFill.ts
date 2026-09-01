import * as React from 'react';
import { autoFillStep, AutoFillResult, ExtractedField } from '@/services/autoFill';
import { useToast } from '@/components/workspace/ToastProvider';

export interface UseAutoFillOptions {
  applicationId: string;
  onFieldsExtracted?: (fields: Record<string, ExtractedField>) => void;
}

export interface UseAutoFillReturn {
  autoFill: (step: 'kyc' | 'business' | 'financials' | 'loan') => Promise<AutoFillResult | null>;
  extracting: boolean;
  lastResult: AutoFillResult | null;
  error: string | null;
}

export function useAutoFill({ applicationId, onFieldsExtracted }: UseAutoFillOptions): UseAutoFillReturn {
  const [extracting, setExtracting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<AutoFillResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const toast = useToast();

  const autoFill = React.useCallback(
    async (step: 'kyc' | 'business' | 'financials' | 'loan') => {
      if (!applicationId) {
        setError('No application ID provided');
        return null;
      }

      setExtracting(true);
      setError(null);

      try {
        const result = await autoFillStep(applicationId, step);
        setLastResult(result);

        const fieldCount = Object.keys(result.extractedFields).length;
        if (fieldCount > 0) {
          toast(`Extracted ${fieldCount} field(s) from documents`, 'success');
          onFieldsExtracted?.(result.extractedFields);
        } else {
          toast('No fields could be extracted for this step', 'info');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Auto-fill failed';
        setError(message);
        toast(message, 'error');
        return null;
      } finally {
        setExtracting(false);
      }
    },
    [applicationId, onFieldsExtracted, toast],
  );

  return { autoFill, extracting, lastResult, error };
}
