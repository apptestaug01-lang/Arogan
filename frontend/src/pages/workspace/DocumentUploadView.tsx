import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDropzone, FileDropzoneHandle } from '@/components/workspace/FileDropzone';
import { StatusTag } from '@/components/workspace/StatusTag';
import {
  listDocuments,
  deleteDocument,
  bulkDeleteDocuments,
  DocumentSummary,
} from '@/services/documents';
import { createApplication } from '@/services/applications';
import { formatBytes } from '@/constants/documents';
import { useToast } from '@/components/workspace/ToastProvider';
import {
  UploadCloud,
  Trash2,
  FileText,
  FileImage,
  FileSpreadsheet,
  Inbox,
  Loader2,
  Eye,
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
  const navigate = useNavigate();
  const dropzoneRef = React.useRef<FileDropzoneHandle>(null);
  const [searchParams] = useSearchParams();

  // Only honour an explicit ?applicationId=... query param. We do NOT auto-pick
  // the user's most recent application: uploads must be tied to a deliberately
  // created application, otherwise the autofill pipeline would attach files to
  // whatever app happens to be at the top of the list.
  const [applicationId, setApplicationId] = React.useState<string | null>(
    searchParams.get('applicationId'),
  );
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [creatingApp, setCreatingApp] = React.useState(false);

  const handleCreateApplication = React.useCallback(async () => {
    setCreatingApp(true);
    try {
      const { application } = await createApplication({ data: {} });
      toast(`Application ${application.applicationId} created`, 'success');
      navigate('/dashboard/applications/new', { state: { applicationId: application.applicationId } });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create application';
      toast(message, 'error');
    } finally {
      setCreatingApp(false);
    }
  }, [navigate, toast]);

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
    fetchDocuments().finally(() => setRefreshing(false));
  }, [fetchDocuments]);

  const existingDocs = React.useMemo(
    () =>
      documents
        .map((d) => ({ originalName: d.originalName, size: d.size })),
    [documents],
  );

  const totalSize = documents.reduce((acc, d) => acc + (d.size || 0), 0);

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

  const handleDocumentDeleted = () => {
    fetchDocuments();
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
              {applicationId ? (
                <FileDropzone
                  ref={dropzoneRef}
                  applicationId={applicationId}
                  existingDocs={existingDocs}
                  onUploadComplete={handleUploadComplete}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <UploadCloud className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <h3 className="mb-1 text-base font-semibold text-gray-900">
                    Create a new application to upload documents
                  </h3>
                  <p className="mb-5 text-sm text-gray-600">
                    Uploads are tied to a specific application. Create one to enable the file
                    browser.
                  </p>
                  <Button onClick={handleCreateApplication} disabled={creatingApp}>
                    {creatingApp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        Create New Application
                      </>
                    )}
                  </Button>
                </div>
              )}
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
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No files in the vault yet</p>
                  <p className="text-sm text-muted-foreground">
                    Drop your first document above.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <div className="divide-y divide-border">
                      {documents.map((d) => (
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
                              <DocStatus status={d.status} />
                              <span className="text-xs text-muted-foreground">
                                {formatBytes(d.size || 0)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
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
                  </div>
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
