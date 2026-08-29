import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/workspace/ToastProvider';
import { useAuth } from '@/services/authContext';
import { cn } from '@/lib/utils';
import { autoFillFromDocuments } from '@/lib/extraction/extractApplication';
import { listDocuments, type DocumentSummary } from '@/services/documents';
import { FIELD_DEFINITIONS } from '@/lib/extraction/fields';
import type { ApplicationDraft, Confidence, ExtractionResult, VaultDocumentInput } from '@/lib/extraction';
import { createApplication, updateApplication } from '@/services/applications';
import { Sparkles, Loader2, CheckCircle2, CircleDashed, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const CONFIDENCE_STYLE: Record<Confidence, string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const FIELD_LABELS: Record<string, string> = {};
FIELD_DEFINITIONS.forEach((def) => {
  FIELD_LABELS[def.key] = def.label;
});

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', CONFIDENCE_STYLE[confidence])}>
      {confidence}
    </span>
  );
}

export function ApplicationAutoFill({
  onApply,
  applicationId,
}: {
  onApply: (values: Partial<ApplicationDraft>) => void;
  applicationId?: string;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<ExtractionResult | null>(null);
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [selectedDocIds, setSelectedDocIds] = React.useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = React.useState<Set<string>>(new Set());
  const [mapping, setMapping] = React.useState<Record<string, string>>({});
  const [showMapping, setShowMapping] = React.useState(false);

  const loadDocuments = React.useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
      setSelectedDocIds(new Set(docs.map((d) => d.id)));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load documents', 'error');
    }
  }, [toast]);

  const run = React.useCallback(async () => {
    setLoading(true);
    setResult(null);
    setMapping({});
    try {
      await loadDocuments();
      const selectedDocs = documents.filter((d) => selectedDocIds.has(d.id));
      const res = await autoFillFromDocuments(selectedDocs as VaultDocumentInput[]);
      setResult(res);
      const found = Object.keys(res.values).length;
      toast(`Found ${found} of ${FIELD_DEFINITIONS.length} fields`, 'info');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not read the vault', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadDocuments, documents, selectedDocIds, toast]);

  const toggleDoc = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const toggleFieldExpand = (fieldKey: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  const setFieldSource = (fieldKey: string, docId: string) => {
    setMapping((prev) => ({ ...prev, [fieldKey]: docId }));
  };

  const getFieldValue = (fieldKey: string): { value: string; confidence: Confidence; docName: string } | null => {
    if (!result) return null;
    const mappedDocId = mapping[fieldKey];
    const ef = result.fields[fieldKey as keyof typeof result.fields];
    if (ef) {
      if (mappedDocId && ef.source && ef.source.docId === mappedDocId) {
        return { value: ef.value, confidence: ef.confidence, docName: ef.source.docName };
      }
      if (!mappedDocId) {
        return { value: ef.value, confidence: ef.confidence, docName: ef.source?.docName || 'Unknown' };
      }
    }
    return null;
  };

  const apply = () => {
    if (!result) return;
    const values: Partial<ApplicationDraft> = {};
    for (const def of FIELD_DEFINITIONS) {
      const fieldValue = getFieldValue(def.key);
      if (fieldValue) {
        values[def.key] = fieldValue.value;
      }
    }
    onApply(values);
    toast('Applied extracted values to form — please review', 'success');
  };

  const save = async () => {
    if (!result) return;
    const values: Partial<ApplicationDraft> = {};
    for (const def of FIELD_DEFINITIONS) {
      const fieldValue = getFieldValue(def.key);
      if (fieldValue) {
        values[def.key] = fieldValue.value;
      }
    }
    try {
      setSaving(true);
      if (applicationId) {
        await updateApplication({ applicationId, data: values });
      } else {
        await createApplication({ data: values });
      }
      onApply(values);
      toast('Application saved', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadDocuments} disabled={loading}>
              Refresh documents
            </Button>
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Reading vault…' : 'Auto-fill'}
            </Button>
          </div>
        </div>

        {documents.length > 0 && !result && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Select documents to extract from</p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {documents.map((doc) => (
                <label key={doc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{doc.originalName}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Review extracted values before applying
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMapping((prev) => !prev)}
              >
                {showMapping ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showMapping ? 'Hide mapping' : 'Show mapping'}
              </Button>
            </div>

              {showMapping && (
              <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">Document source mapping</p>
                {documents.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedDocIds.has(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{doc.originalName}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {FIELD_DEFINITIONS.map((def) => {
                const ef = result.fields[def.key];
                const fieldValue = getFieldValue(def.key);
                const isExpanded = expandedFields.has(def.key);

                return (
                  <div key={def.key} className="rounded-lg border border-border bg-card">
                    <div className="flex items-start gap-3 px-3 py-2">
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
                        {fieldValue ? (
                          <>
                            <p className="mt-0.5 truncate text-sm text-foreground">{fieldValue.value}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Source: {fieldValue.docName}
                            </p>
                          </>
                        ) : (
                          <p className="mt-0.5 text-xs text-muted-foreground">Not found — fill manually</p>
                        )}
                      </div>
                      {ef && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFieldExpand(def.key)}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    {isExpanded && ef && ef.source && (
                      <div className="border-t border-border px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Snippet:</span> {ef.source.snippet}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground">Map to document:</span>
                          {documents.map((doc) => (
                            <Button
                              key={doc.id}
                              variant={mapping[def.key] === doc.id ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setFieldSource(def.key, doc.id)}
                            >
                              {doc.originalName}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button onClick={apply} disabled={Object.keys(result.values).length === 0}>
                Apply to form
              </Button>
              <Button onClick={save} disabled={saving || Object.keys(result.values).length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save application'}
              </Button>
              <Button variant="ghost" onClick={() => { setResult(null); setMapping({}); }}>
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
