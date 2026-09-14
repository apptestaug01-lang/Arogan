import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDropzone, FileDropzoneHandle } from '@/components/workspace/FileDropzone';
import { VaultDocumentBuckets } from '@/components/workspace/VaultDocumentBuckets';
import {
  listDocuments,
  bulkDeleteDocuments,
  DocumentSummary,
} from '@/services/documents';
import { formatBytes } from '@/constants/documents';
import { useToast } from '@/components/workspace/ToastProvider';
import {
  UploadCloud,
  Trash2,
  Loader2,
} from 'lucide-react';

export default function DocumentUploadView() {
  const toast = useToast();
  const dropzoneRef = React.useRef<FileDropzoneHandle>(null);
  const [searchParams] = useSearchParams();

  const applicationId = searchParams.get('applicationId') ?? undefined;
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
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
    fetchDocuments().finally(() => setRefreshing(false));
  }, [fetchDocuments]);

  const existingDocs = React.useMemo(
    () =>
      documents
        .map((d) => ({ originalName: d.originalName, size: d.size })),
    [documents],
  );

  const totalSize = documents.reduce((acc, d) => acc + (d.size || 0), 0);

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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Document upload</p>
        <h1 className="page-title">Document upload</h1>
        <p className="page-sub">Add files securely to your loan workspace.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload documents</CardTitle>
            </CardHeader>
    <CardContent className="space-y-5">
      <FileDropzone
        ref={dropzoneRef}
        applicationId={applicationId}
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
              <VaultDocumentBuckets documents={documents} />
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
