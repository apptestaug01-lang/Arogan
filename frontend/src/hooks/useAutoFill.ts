import * as React from 'react';
import { autoFillStep, AutoFillResult, ExtractedField } from '@/services/autoFill';
import { useToast } from '@/components/workspace/ToastProvider';

export interface ExtractionProgress {
  currentDocument: string;
  currentIndex: number;
  totalDocuments: number;
  phase: 'reading' | 'parsing' | 'extracting' | 'done';
}

export interface UseAutoFillOptions {
  applicationId: string;
  onFieldsExtracted?: (fields: Record<string, ExtractedField>) => void;
  onProgress?: (progress: ExtractionProgress) => void;
}

export interface UseAutoFillReturn {
  autoFill: (step: 'kyc' | 'business' | 'financials' | 'loan') => Promise<AutoFillResult | null>;
  extracting: boolean;
  lastResult: AutoFillResult | null;
  error: string | null;
  progress: ExtractionProgress | null;
}

export function useAutoFill({ applicationId, onFieldsExtracted, onProgress }: UseAutoFillOptions): UseAutoFillReturn {
  const [extracting, setExtracting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<AutoFillResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<ExtractionProgress | null>(null);
  const toast = useToast();

  const autoFill = React.useCallback(
    async (step: 'kyc' | 'business' | 'financials' | 'loan') => {
      if (!applicationId) {
        setError('No application ID provided');
        return null;
      }

      setExtracting(true);
      setError(null);
      setProgress({ currentDocument: 'Starting...', currentIndex: 0, totalDocuments: 0, phase: 'reading' });
      onProgress?.({ currentDocument: 'Starting...', currentIndex: 0, totalDocuments: 0, phase: 'reading' });

      try {
        const { data: result, cacheStatus } = await autoFillStep(applicationId, step);
        setLastResult(result);
        setProgress({ currentDocument: '', currentIndex: 0, totalDocuments: 0, phase: 'done' });

        const fieldCount = Object.keys(result.extractedFields).length;
        if (fieldCount > 0) {
          const source = cacheStatus === 'cached' ? ' (cached)' : '';
          toast(`Extracted ${fieldCount} field(s) from documents${source}`, 'success');
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
    [applicationId, onFieldsExtracted, onProgress, toast],
  );

  return { autoFill, extracting, lastResult, error, progress };
}
