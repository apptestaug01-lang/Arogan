import * as React from 'react';
import { CheckCircle2, AlertCircle, Loader2, FileText, UploadCloud, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractOneDocument, getAutoFillStatus, ExtractedField } from '@/services/autoFill';

type DocStatus = 'pending' | 'queued' | 'extracting' | 'ready' | 'failed';

interface VaultDoc {
  id: string;
  originalName: string;
  extraction: {
    status: string;
    documentType?: string;
    modelUsed?: string | null;
    error?: string | null;
  } | null;
}

const STEP_FOR_DOC: Array<{ match: RegExp; step: 'kyc' | 'business' | 'financials' | 'loan' }> = [
  { match: /pan|aadhaar/i, step: 'kyc' },
  { match: /gst|cin|incorporation/i, step: 'business' },
  { match: /balance|itr|bank|statement/i, step: 'financials' },
  { match: /sanction|loan/i, step: 'loan' },
];

function classifyDoc(name: string): 'kyc' | 'business' | 'financials' | 'loan' {
  for (const r of STEP_FOR_DOC) if (r.match.test(name)) return r.step;
  return 'kyc';
}

export interface DocumentExtractionStepperProps {
  applicationId: string;
  /**
   * Called when extraction of a doc completes and the user clicks
   * "Apply & Continue" on that doc's step. Receives the fields merged into
   * the wizard draft. Parent must apply to wizard state, save the draft,
   * and advance to the next step.
   */
  onApplyStep: (step: 'kyc' | 'business' | 'financials' | 'loan', fields: Record<string, ExtractedField>) => void;
  onAdvance: (nextStep: 'kyc' | 'business' | 'financials' | 'loan') => void;
  onAllDone: () => void;
}

export function DocumentExtractionStepper({ applicationId, onApplyStep, onAdvance, onAllDone }: DocumentExtractionStepperProps) {
  const [docs, setDocs] = React.useState<VaultDoc[]>([]);
  const [docStatus, setDocStatus] = React.useState<Record<string, DocStatus>>({});
  const [docFields, setDocFields] = React.useState<Record<string, Record<string, ExtractedField>>>({});
  const [loading, setLoading] = React.useState(true);
  const [autoRunning, setAutoRunning] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Poll vault status until everything is ready/failed.
  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const status = await getAutoFillStatus(applicationId);
        if (cancelled) return;
        setDocs(status.documents);
        setDocStatus((prev) => {
          const next = { ...prev };
          for (const d of status.documents) {
            if (next[d.id]) continue; // don't override interactive state
            if (d.extraction?.status === 'completed') next[d.id] = 'ready';
            else if (d.extraction?.status === 'failed') next[d.id] = 'failed';
            else if (d.extraction?.status === 'processing') next[d.id] = 'extracting';
            else next[d.id] = 'pending';
          }
          return next;
        });
        const allDone = status.documents.length > 0 && status.documents.every((d) => d.extraction && (d.extraction.status === 'completed' || d.extraction.status === 'failed'));
        if (!allDone) {
          timer = setTimeout(poll, 2000);
        } else {
          setLoading(false);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load vault');
        timer = setTimeout(poll, 3000);
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [applicationId]);

  // Auto-extract each pending doc once it appears in the vault (in order).
  React.useEffect(() => {
    if (!autoRunning) return;
    const next = docs.find((d) => docStatus[d.id] === 'pending' || docStatus[d.id] === 'failed');
    if (!next) {
      if (docs.length > 0 && docs.every((d) => docStatus[d.id] === 'ready')) {
        setAutoRunning(false);
        onAllDone();
      }
      return;
    }
    setDocStatus((s) => ({ ...s, [next.id]: 'extracting' }));
    (async () => {
      try {
        const res = await extractOneDocument(applicationId, next.id, true);
        setDocFields((f) => ({ ...f, [next.id]: res.fields }));
        setDocStatus((s) => ({ ...s, [next.id]: 'ready' }));
      } catch (e) {
        setDocStatus((s) => ({ ...s, [next.id]: 'failed' }));
      }
    })();
  }, [docs, docStatus, autoRunning, applicationId, onAllDone]);

  const handleApplyStep = (doc: VaultDoc) => {
    const fields = docFields[doc.id] || {};
    const step = classifyDoc(doc.originalName);
    onApplyStep(step, fields);
  };

  const orderByStep = (a: VaultDoc, b: VaultDoc) => {
    const order: Record<string, number> = { kyc: 0, business: 1, financials: 2, loan: 3 };
    return order[classifyDoc(a.originalName)] - order[classifyDoc(b.originalName)];
  };
  const ordered = [...docs].sort(orderByStep);

  if (loading && docs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
          <p className="text-sm font-medium">Loading your uploaded documents…</p>
        </div>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <UploadCloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No documents uploaded yet</p>
        <p className="mt-1 text-xs text-muted-foreground">Go to the Documents page and upload PAN, Aadhaar, GST and balance sheet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-medium">Document extraction</span>
            <span className="text-xs text-muted-foreground">
              · {ordered.filter((d) => docStatus[d.id] === 'ready').length} / {ordered.length} ready
            </span>
          </div>
          {error && <span className="text-xs text-danger-500">{error}</span>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          We extract fields from each document, apply them to the matching step, then save the draft and move on.
        </p>
      </div>

      {ordered.map((d) => {
        const status = docStatus[d.id] || 'pending';
        const fields = docFields[d.id] || {};
        const step = classifyDoc(d.originalName);
        return (
          <div key={d.id} className="rounded-xl border border-border bg-card p-4" data-testid={`extraction-row-${d.id}`} data-step={step}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {status === 'ready' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                {status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
                {(status === 'pending' || status === 'extracting') && <Loader2 className="h-5 w-5 animate-spin text-primary-600" />}
                <div>
                  <p className="text-sm font-medium">{d.originalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.extraction?.documentType ? `${d.extraction.documentType.replace(/_/g, ' ').toLowerCase()} · ` : ''}
                    routed to <b>{step.toUpperCase()}</b>
                    {d.extraction?.modelUsed ? ` · ${d.extraction.modelUsed}` : ''}
                  </p>
                </div>
              </div>
              <div>
                {status === 'ready' && Object.keys(fields).length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      handleApplyStep(d);
                      onAdvance(step);
                    }}
                    data-testid={`apply-${d.id}`}
                  >
                    Apply {Object.keys(fields).length} field(s) & continue
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
                {status === 'ready' && Object.keys(fields).length === 0 && (
                  <span className="text-xs text-muted-foreground">No form fields matched this document</span>
                )}
                {status === 'failed' && (
                  <span className="text-xs text-red-500">Extraction failed — you can fill this step manually</span>
                )}
                {(status === 'pending' || status === 'extracting') && (
                  <span className="text-xs text-muted-foreground">{status === 'extracting' ? 'Extracting…' : 'Waiting…'}</span>
                )}
              </div>
            </div>
            {status === 'ready' && Object.keys(fields).length > 0 && (
              <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {Object.entries(fields).slice(0, 6).map(([k, v]) => (
                  <li key={k} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{k}</span>: {String((v as ExtractedField).value).slice(0, 40)}
                  </li>
                ))}
                {Object.keys(fields).length > 6 && (
                  <li className="text-xs text-muted-foreground">+{Object.keys(fields).length - 6} more</li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
