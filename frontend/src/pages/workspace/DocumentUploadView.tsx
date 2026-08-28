import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDropzone, FileDropzoneHandle } from '@/components/workspace/FileDropzone';
import { StatusTag } from '@/components/workspace/StatusTag';
import {
  listDocuments,
  deleteDocument,
  bulkDeleteDocuments,
  getDocumentView,
  DocumentSummary,
} from '@/services/documents';
import { DOCUMENT_CATEGORIES, formatBytes } from '@/constants/documents';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/workspace/ToastProvider';
import {
  UploadCloud,
  Trash2,
  CheckCircle2,
  Circle,
  FileText,
  FileImage,
  FileSpreadsheet,
  Eye,
  Plus,
  Inbox,
  Loader2,
} from 'lucide-react';

const KNOWN_STATUSES = ['Reviewing', 'Draft', 'Verified', 'Uploaded'] as const;

function FileIcon({ contentType }: { contentType: string }) {
  const cls = 'h-5 w-5 shrink-0 text-primary-600';
  if (contentType.startsWith('image/')) return <FileImage className={cls} />;
  if (contentType.includes('sheet') || contentType.includes('excel'))
    return <FileSpreadsheet className={cls} />;
  return <FileText className={cls} />;
}

function DocStatus({ status }: { status: string }) {
  if ((KNOWN_STATUSES as readonly string[]).includes(status)) {
    return <StatusTag status={status as (typeof KNOWN_STATUSES)[number]} />;
  }
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      {status}
    </span>
  );
}

export default function DocumentUploadView() {
  const toast = useToast();
  const dropzoneRef = React.useRef<FileDropzoneHandle>(null);

  const [category, setCategory] = React.useState<string>(DOCUMENT_CATEGORIES[0]);
  const [applicationId] = React.useState('LAP-2026-0184');
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [view, setView] = React.useState<string>('all');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchDocuments = React.useCallback(async () => {
    try {
      setDocuments(await listDocuments());
    } catch {
      // Non-fatal: checklist refreshes on the next event.
    }
  }, []);

  React.useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  React.useEffect(() => {
    const handler = () => fetchDocuments();
    window.addEventListener('document:uploaded', handler);
    window.addEventListener('document:deleted', handler);
    return () => {
      window.removeEventListener('document:uploaded', handler);
      window.removeEventListener('document:deleted', handler);
    };
  }, [fetchDocuments]);

  const handleUploadComplete = React.useCallback(() => {
    setRefreshing(true);
    setView(category);
    fetchDocuments().finally(() => setRefreshing(false));
  }, [fetchDocuments, category]);

  const existingDocs = React.useMemo(
    () =>
      documents
        .filter((d) => d.category === category)
        .map((d) => ({ originalName: d.originalName, size: d.size })),
    [documents, category],
  );

  const counts = React.useMemo(() => {
    const map: Record<string, number> = {};
    DOCUMENT_CATEGORIES.forEach((c) => (map[c] = 0));
    documents.forEach((d) => {
      if (map[d.category] !== undefined) map[d.category] += 1;
    });
    return map;
  }, [documents]);

  const categoriesWithFiles = DOCUMENT_CATEGORIES.filter((c) => counts[c] > 0).length;
  const coverage = Math.round((categoriesWithFiles / DOCUMENT_CATEGORIES.length) * 100);
  const totalSize = documents.reduce((acc, d) => acc + (d.size || 0), 0);

  const sections = React.useMemo(() => {
    const cats =
      view === 'all'
        ? DOCUMENT_CATEGORIES.filter((c) => counts[c] > 0)
        : [view];
    return cats.map((c) => ({
      category: c,
      items: documents.filter((d) => d.category === c),
    }));
  }, [view, documents, counts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteOne = async (id: string) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast('Document deleted', 'success');
      window.dispatchEvent(new CustomEvent('document:deleted'));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected document(s)?`)) return;
    try {
      await bulkDeleteDocuments([...selectedIds]);
      setDocuments((prev) => prev.filter((d) => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
      toast('Documents deleted', 'success');
      window.dispatchEvent(new CustomEvent('document:deleted'));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  const addToCategory = (c: string) => {
    setCategory(c);
    dropzoneRef.current?.openPicker();
  };

  const viewDocument = async (doc: DocumentSummary) => {
    try {
      const res = await getDocumentView(doc.id);
      window.open(res.viewUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open file', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Document upload</p>
        <h1 className="page-title">Document upload</h1>
        <p className="page-sub">Add files securely to application {applicationId}.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Upload to</label>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        category === c
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-input bg-background text-foreground hover:border-primary-600',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  New files will be tagged as{' '}
                  <span className="font-medium text-primary-600">{category}</span>
                </p>
              </div>

              <FileDropzone
                ref={dropzoneRef}
                applicationId={applicationId}
                category={category}
                existingDocs={existingDocs}
                onUploadComplete={handleUploadComplete}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    S3 Vault
                    {refreshing && (
                      <span className="inline-flex items-center gap-1 text-xs font-normal text-primary-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Syncing…
                      </span>
                    )}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Every file uploaded for this application.
                  </p>
                </div>
                <div className="text-right">
                  <p className="metric-value">{documents.length}</p>
                  <p className="text-xs text-muted-foreground">files · {formatBytes(totalSize)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {categoriesWithFiles} of {DOCUMENT_CATEGORIES.length} categories covered
                  </span>
                  <span className="text-muted-foreground">{coverage}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary-600 transition-all"
                    style={{ width: `${coverage}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['all', ...DOCUMENT_CATEGORIES] as string[]).map((c) => {
                  const active = view === c;
                  const count = c === 'all' ? documents.length : counts[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setView(c)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                        active
                          ? 'border-primary-600 bg-primary-50 text-primary-600'
                          : 'border-input text-muted-foreground hover:border-primary-600',
                      )}
                    >
                      {c === 'all' ? 'All' : c}
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-[10px] font-semibold',
                          active ? 'bg-primary-600 text-white' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No files in the vault yet</p>
                  <p className="text-sm text-muted-foreground">
                    Pick a category above and drop your first document.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {sections.map((section) => (
                    <div key={section.category}>
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <div className="flex items-center gap-2">
                          {section.items.length > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Circle className="h-4 w-4 text-slate-300" />
                          )}
                          <h3 className="text-sm font-semibold text-foreground">
                            {section.category}
                          </h3>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {section.items.length}
                          </span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => addToCategory(section.category)}>
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>

                      {section.items.length === 0 ? (
                        <p className="py-3 text-sm text-muted-foreground">No files yet.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {section.items.map((d) => (
                            <div key={d.id} className="flex items-center gap-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(d.id)}
                                onChange={() => toggleSelect(d.id)}
                                className="h-4 w-4"
                                aria-label={`Select ${d.originalName}`}
                              />
                              <FileIcon contentType={d.contentType} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {d.originalName}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  {view === 'all' && (
                                    <span className="rounded bg-primary-50 px-2 py-0.5 text-xs text-primary-600">
                                      {d.category}
                                    </span>
                                  )}
                                  <DocStatus status={d.status} />
                                  <span className="text-xs text-muted-foreground">
                                    {formatBytes(d.size || 0)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => viewDocument(d)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                                  aria-label="View document"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteOne(d.id)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-danger-500/10 hover:text-danger-500"
                                  aria-label="Delete document"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {documents.length > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => dropzoneRef.current?.openPicker()}>
                      <UploadCloud className="h-4 w-4" />
                      Add files
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={selectedIds.size === 0}
                      onClick={handleDeleteSelected}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete selected
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document checklist</CardTitle>
              <p className="text-sm text-muted-foreground">Track what still needs uploading.</p>
            </CardHeader>
            <CardContent className="space-y-1">
              {DOCUMENT_CATEGORIES.map((c) => {
                const done = counts[c] > 0;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setView(c);
                      setCategory(c);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      {done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300" />
                      )}
                      <span className={cn('font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>
                        {c}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {done ? `${counts[c]} file${counts[c] > 1 ? 's' : ''}` : 'Pending'}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
            <b className="text-foreground">☁ Storage safeguards</b>
            <br />
            <br />
            Files use short-lived pre-signed upload URLs. Each upload keeps its version,
            uploader, timestamp, and application ID in the audit trail, and is scanned before
            it becomes available for review.
          </div>
        </aside>
      </div>
    </div>
  );
}
