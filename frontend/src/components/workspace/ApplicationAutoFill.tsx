import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/workspace/ToastProvider';
import { cn } from '@/lib/utils';
import { autoFillFromDocuments } from '@/lib/extraction/extractApplication';
import { listDocuments, type DocumentSummary } from '@/services/documents';
import { FIELD_DEFINITIONS } from '@/lib/extraction/fields';
import type { ApplicationDraftKey, Confidence, ExtractionResult, VaultDocumentInput } from '@/lib/extraction';
import { Sparkles, Loader2, CheckCircle2, CircleDashed } from 'lucide-react';

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

export function ApplicationAutoFill({
  onApply,
}: {
  onApply: (values: Partial<Record<ApplicationDraftKey, string>>) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ExtractionResult | null>(null);
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      if (docs.length === 0) {
        toast('No documents found in vault. Upload documents first.', 'info');
        return;
      }
      const res = await autoFillFromDocuments(docs as VaultDocumentInput[]);
      setResult(res);
      const found = Object.keys(res.values).length;
      toast(`Found ${found} of ${FIELD_DEFINITIONS.length} fields from ${docs.length} document(s)`, 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read the vault', 'error');
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const values: Partial<Record<ApplicationDraftKey, string>> = {};
    for (const def of FIELD_DEFINITIONS) {
      const ef = result.fields[def.key];
      if (ef) {
        values[def.key] = ef.value;
      }
    }
    onApply(values);
    toast(`Applied ${Object.keys(values).length} extracted values to form`, 'success');
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Auto-fill from documents</p>
          <p className="text-xs text-muted-foreground">
            Extract details from uploaded documents and prefill the form.
          </p>
        </div>
        <div className="flex gap-2">
          {!result ? (
            <Button size="sm" onClick={run} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Reading vault…' : 'Auto-fill'}
            </Button>
          ) : (
            <Button size="sm" onClick={apply}>
              Apply to form
            </Button>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Extracted {Object.keys(result.values).length} field(s) from {documents.length} document(s).
            Fields not found below will need to be filled manually.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FIELD_DEFINITIONS.map((def) => {
              const ef = result.fields[def.key];
              return (
                <div
                  key={def.key}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  {ef ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{def.label}</span>
                      {ef && (
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', CONFIDENCE_STYLE[ef.confidence])}>
                          {ef.confidence}
                        </span>
                      )}
                    </div>
                    {ef ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {ef.value}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground">Not found — fill manually</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
