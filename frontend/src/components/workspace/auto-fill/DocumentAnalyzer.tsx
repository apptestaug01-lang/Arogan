import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ExtractedField, ExtractAllResult } from '@/services/autoFill';
import { CheckCircle2, AlertCircle, FileText, Loader2, Zap } from 'lucide-react';
import { VaultDocumentsPanel } from './VaultDocumentsPanel';
import { ExtractionResultPanel } from './ExtractionResultPanel';

export interface ExtractionProgress {
  currentDocument: string;
  currentIndex: number;
  totalDocuments: number;
  phase: 'reading' | 'parsing' | 'extracting' | 'done';
}

interface DocumentAnalyzerProps {
  applicationId: string;
  extracting: boolean;
  extractedFields: Record<string, ExtractedField>;
  unmatchedDocuments?: string[];
  missingFields?: string[];
  onAutoFill: (force?: boolean) => void;
  onApplyField: (fieldName: string, value: string | number | boolean | string[]) => void;
  onApplyAll: (fields: Record<string, ExtractedField>) => void;
  stepLabel: string;
  progress?: ExtractionProgress | null;
  fullResult?: ExtractAllResult | null;
  refreshKey?: number;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    percentage >= 90
      ? 'bg-emerald-100 text-emerald-700'
      : percentage >= 70
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {percentage}%
    </span>
  );
}

export function DocumentAnalyzer({
  applicationId,
  extracting,
  extractedFields,
  unmatchedDocuments = [],
  missingFields = [],
  onAutoFill,
  onApplyField,
  onApplyAll,
  stepLabel,
  progress,
  fullResult,
  refreshKey,
}: DocumentAnalyzerProps) {
  const [expanded, setExpanded] = useState(true);

  const fieldEntries = Object.entries(extractedFields);
  const hasResults = fieldEntries.length > 0 || unmatchedDocuments.length > 0;
  const allApplied = fieldEntries.length > 0;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-medium">Document Analysis</span>
            <span className="text-xs text-muted-foreground">— {stepLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAutoFill(true)}
              disabled={extracting}
              title="Bypass cache and re-run LLM/regex extraction"
            >
              <Zap className="h-3.5 w-3.5" />
              Force re-extract
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => onAutoFill(false)}
              disabled={extracting}
            >
              {extracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reading documents…
                </>
              ) : (
                '⟳ Auto-Fill from Documents'
              )}
            </Button>
          </div>
        </div>

        {extracting && (
          <div className="border-t border-border bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              <span className="text-sm font-medium text-slate-700">
                {progress?.currentDocument || 'Reading documents from vault and extracting fields…'}
              </span>
            </div>
            {progress && progress.totalDocuments > 0 && (
              <p className="mt-2 text-xs text-slate-500">
                {progress.currentIndex} / {progress.totalDocuments} document(s) · phase: {progress.phase}
              </p>
            )}
            {progress?.currentIndex === 0 && progress?.totalDocuments === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Loading documents and downloading from S3…
              </p>
            )}
          </div>
        )}

        {hasResults && !extracting && (
          <div className="border-t border-border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-accent"
              onClick={() => setExpanded(!expanded)}
            >
              <span>
                ✓ {fieldEntries.length} field(s) extracted for this step
                {unmatchedDocuments.length > 0 && `, ${unmatchedDocuments.length} unmatched`}
              </span>
              <span>{expanded ? '▲' : '▼'}</span>
            </button>

            {expanded && (
              <div className="space-y-3 border-t border-border p-4">
                {allApplied && (
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => onApplyAll(extractedFields)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Apply all {fieldEntries.length} field(s) to form
                  </Button>
                )}

                {fieldEntries.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Extracted Fields</p>
                    <div className="space-y-2">
                      {fieldEntries.map(([fieldName, field]) => (
                        <div
                          key={fieldName}
                          className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium capitalize">
                                {fieldName.replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                              <ConfidenceBadge confidence={field.confidence} />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Source: {field.source}
                            </p>
                            {field.raw && (
                              <p className="mt-1 truncate text-xs text-muted-foreground/70">
                                Raw: {field.raw}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="max-w-[200px] truncate text-sm font-medium">
                              {Array.isArray(field.value) ? field.value.join(', ') : String(field.value)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onApplyField(fieldName, field.value)}
                              className="rounded p-1 text-primary-600 hover:bg-primary-50"
                              title="Apply to form"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {missingFields.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Missing Fields (this step)</p>
                    <div className="flex flex-wrap gap-2">
                      {missingFields.map((field) => (
                        <span
                          key={field}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700"
                        >
                          <AlertCircle className="h-3 w-3" />
                          {field.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {unmatchedDocuments.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-foreground">Unmatched Documents (this step)</p>
                    <div className="flex flex-wrap gap-2">
                      {unmatchedDocuments.map((doc) => (
                        <span
                          key={doc}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                        >
                          <FileText className="mr-1 h-3 w-3" />
                          {doc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <VaultDocumentsPanel applicationId={applicationId} refreshKey={refreshKey} />

      <ExtractionResultPanel result={fullResult ?? null} />
    </div>
  );
}
