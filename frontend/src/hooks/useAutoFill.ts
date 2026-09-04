import * as React from 'react';
import { extractAllDocuments, ExtractAllResult, ExtractedField } from '@/services/autoFill';
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
  autoFill: (step: 'kyc' | 'business' | 'financials' | 'loan' | 'all', force?: boolean) => Promise<ExtractAllResult | null>;
  extracting: boolean;
  lastResult: ExtractAllResult | null;
  error: string | null;
  progress: ExtractionProgress | null;
}

export function useAutoFill({ applicationId, onFieldsExtracted, onProgress }: UseAutoFillOptions): UseAutoFillReturn {
  const [extracting, setExtracting] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<ExtractAllResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<ExtractionProgress | null>(null);
  const toast = useToast();

  const autoFill = React.useCallback(
    async (step: 'kyc' | 'business' | 'financials' | 'loan' | 'all', force = false) => {
      if (!applicationId) {
        const msg = 'No application ID provided';
        setError(msg);
        toast(msg, 'error');
        return null;
      }

      setExtracting(true);
      setError(null);
      setProgress({ currentDocument: 'Starting extraction…', currentIndex: 0, totalDocuments: 0, phase: 'reading' });
      onProgress?.({ currentDocument: 'Starting extraction…', currentIndex: 0, totalDocuments: 0, phase: 'reading' });

      try {
        const result = await extractAllDocuments(applicationId, force);
        setLastResult(result);
        setProgress({ currentDocument: '', currentIndex: result.processedDocuments, totalDocuments: result.totalDocuments, phase: 'done' });

        const fieldCount = Object.keys(result.extractedFields).length;
        if (fieldCount > 0) {
          const source = result.cacheStatus === 'cached' ? ' (cached)' : result.cacheStatus === 'live' ? ' (re-extracted)' : '';
          const perStep: string[] = [];
          for (const [s, fields] of Object.entries(result.fieldsByStep)) {
            const c = Object.keys(fields as Record<string, unknown>).length;
            if (c > 0) perStep.push(`${s}:${c}`);
          }
          const stepHint = perStep.length > 0 ? ` (${perStep.join(', ')})` : '';
          toast(`Extracted ${fieldCount} field(s) from ${result.processedDocuments} document(s)${source}${stepHint}`, 'success');
          onFieldsExtracted?.(result.extractedFields);
        } else if (result.totalDocuments === 0) {
          toast('No documents in vault. Upload documents first.', 'info');
        } else {
          toast(`Processed ${result.processedDocuments} document(s) but no form fields could be extracted. Try "Force re-extract".`, 'info');
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Auto-fill failed';
        setError(message);
        toast(`Auto-fill failed: ${message}`, 'error');
        return null;
      } finally {
        setExtracting(false);
      }
    },
    [applicationId, onFieldsExtracted, onProgress, toast],
  );

  return { autoFill, extracting, lastResult, error, progress };
}
