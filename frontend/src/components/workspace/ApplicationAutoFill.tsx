import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/workspace/ToastProvider';
import { cn } from '@/lib/utils';
import { autoFillFromVault, FIELD_DEFINITIONS } from '@/lib/extraction';
import type { ApplicationDraft, Confidence, ExtractionResult } from '@/lib/extraction';
import { Sparkles, Loader2, FileText, CheckCircle2, CircleDashed } from 'lucide-react';

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', CONFIDENCE_STYLE[confidence])}>
      {confidence}
    </span>
  );
}

export function ApplicationAutoFill({
  onApply,
}: {
  onApply: (values: Partial<ApplicationDraft>) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<ExtractionResult | null>(null);

  const run = React.useCallback(async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await autoFillFromVault();
      setResult(res);
      const found = Object.keys(res.values).length;
      toast(`Found ${found} of ${FIELD_DEFINITIONS.length} fields in the vault`, 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read the vault', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const apply = () => {
    if (!result) return;
    onApply(result.values);
    toast('Application prefilled from documents — please review', 'success');
    setResult(null);
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">Auto-fill from documents</p>
            <p className="text-sm text-muted-foreground">
              Extract borrower, loan and financial details from the S3 vault and prefill this form.
            </p>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Reading vault…' : 'Auto-fill'}
          </Button>
        </div>

        {result && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">
              Review extracted values before applying
            </p>
            <div className="divide-y divide-border rounded-lg border border-border bg-card">
              {FIELD_DEFINITIONS.map((def) => {
                const ef = result.fields[def.key];
                return (
                  <div key={def.key} className="flex items-start gap-3 px-3 py-2">
                    {ef ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{def.label}</span>
                        {ef && <ConfidenceBadge confidence={ef.confidence} />}
                      </div>
                      {ef ? (
                        <>
                          <p className="mt-0.5 truncate text-sm text-foreground">{ef.value}</p>
                          {ef.source && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {ef.source.docName} · {ef.source.snippet}
                              </span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">Not found — fill manually</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button onClick={apply} disabled={Object.keys(result.values).length === 0}>
                Apply to form
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ApplicationAutoFill;
