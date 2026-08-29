import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionRow } from '@/components/workspace/SectionRow';
import { useToast } from '@/components/workspace/ToastProvider';
import { listDocuments, bulkDeleteDocuments, DocumentSummary } from '@/services/documents';
import { Trash2, AlertTriangle, FolderOpen } from 'lucide-react';

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

export default function DocumentManageView() {
  const toast = useToast();
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState(false);

  const fetchDocuments = React.useCallback(async () => {
    setLoading(true);
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(() => {
      const next = new Set<string>();
      if (checked) {
        documents.forEach((d) => next.add(d.id));
      }
      return next;
    });
  };

  const selectedCount = selected.size;
  const allSelected = documents.length > 0 && selectedCount === documents.length;

  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;
    const ids = Array.from(selected);
    setDeleting(true);
    try {
      await bulkDeleteDocuments(ids);
      setSelected(new Set());
      toast(`${ids.length} document${ids.length > 1 ? 's' : ''} deleted`, 'success');
      window.dispatchEvent(new CustomEvent('document:deleted'));
      await fetchDocuments();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to delete documents', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const isEmpty = !loading && documents.length === 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Manage documents</p>
        <h1 className="page-title">Manage &amp; delete</h1>
        <p className="page-sub">
          Select documents and remove them from storage. Deletions are permanent.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {selectedCount > 0 ? `${selectedCount} selected` : `${documents.length} documents`}
        </span>
        <Button
          variant="destructive"
          size="sm"
          disabled={selectedCount === 0 || deleting}
          onClick={handleBulkDelete}
        >
          <Trash2 className="h-4 w-4" />
          {deleting ? 'Deleting…' : `Delete selected (${selectedCount})`}
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {isEmpty && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No documents yet. Upload some from the upload screen.</p>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>All documents</CardTitle>
                <CardDescription>{documents.length} document{documents.length !== 1 ? 's' : ''}</CardDescription>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && selectedCount > 0;
                  }}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Select all"
                />
                Select all
              </label>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {documents.map((doc) => (
                <SectionRow
                  key={doc.id}
                  title={doc.originalName}
                  description={`${doc.applicationId} · ${formatBytes(doc.size)}${doc.status ? ` · ${doc.status}` : ''}`}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selected.has(doc.id)}
                      onChange={() => toggle(doc.id)}
                      aria-label={`Select ${doc.originalName}`}
                    />
                  </label>
                </SectionRow>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isEmpty && documents.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <span>Only display documents after the backend confirms the S3 upload. Deletions cannot be recovered.</span>
        </div>
      )}
    </div>
  );
}
