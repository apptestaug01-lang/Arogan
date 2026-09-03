import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ExtractedField } from '@/services/autoFill';
import { CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';

export interface ExtractionProgress {
  currentDocument: string;
  currentIndex: number;
  totalDocuments: number;
  phase: 'reading' | 'parsing' | 'extracting' | 'done';
}

interface DocumentAnalyzerProps {
  extracting: boolean;
  extractedFields: Record<string, ExtractedField>;
  unmatchedDocuments: string[];
  missingFields: string[];
  onAutoFill: () => void;
  onApplyField: (fieldName: string, value: string | number | boolean | string[]) => void;
  stepLabel: string;
  progress?: ExtractionProgress | null;
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

function ProgressIndicator({ progress }: { progress: ExtractionProgress }) {
  const phaseLabels: Record<ExtractionProgress['phase'], string> = {
    reading: 'Reading from vault',
    parsing: 'Parsing document',
    extracting: 'Extracting fields',
    done: 'Complete',
  };

  const percentage = progress.totalDocuments > 0
    ? Math.round((progress.currentIndex / progress.totalDocuments) * 100)
    : 0;

  return (
    <div className="border-t border-border bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">
          {phaseLabels[progress.phase]}
        </span>
        <span className="text-slate-500">
          {progress.currentIndex}/{progress.totalDocuments}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      {progress.currentDocument && (
        <p className="mt-2 truncate text-xs text-slate-500">
          {progress.currentDocument}
        </p>
      )}
    </div>
  );
}

export function DocumentAnalyzer({
  extracting,
  extractedFields,
  unmatchedDocuments,
  missingFields,
  onAutoFill,
  onApplyField,
  stepLabel,
  progress,
}: DocumentAnalyzerProps) {
  const [expanded, setExpanded] = React.useState(true);

  const fieldEntries = Object.entries(extractedFields);
  const hasResults = fieldEntries.length > 0 || unmatchedDocuments.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" />
          <span className="text-sm font-medium">Document Analysis</span>
          <span className="text-xs text-muted-foreground">— {stepLabel}</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAutoFill}
          disabled={extracting}
        >
          {extracting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing…
            </>
          ) : (
            '⟳ Auto-Fill from Documents'
          )}
        </Button>
      </div>

      {extracting && progress && (
        <div className="border-t border-border bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            <span className="text-sm font-medium text-slate-700">
              Reading documents from vault and extracting fields...
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This may take a moment depending on the number and size of documents.
          </p>
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
              ✓ {fieldEntries.length} field(s) extracted, {unmatchedDocuments.length} unmatched document(s)
            </span>
            <span>{expanded ? '▲' : '▼'}</span>
          </button>

          {expanded && (
            <div className="space-y-3 border-t border-border p-4">
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
                  <p className="mb-2 text-xs font-medium text-foreground">Missing Fields</p>
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
                  <p className="mb-2 text-xs font-medium text-foreground">Unmatched Documents</p>
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
  );
}
