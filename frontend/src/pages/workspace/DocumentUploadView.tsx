import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionRow } from '@/components/workspace/SectionRow';
import { FileDropzone } from '@/components/workspace/FileDropzone';
import { listDocuments, DocumentSummary } from '@/services/documents';
import { DOCUMENT_CATEGORIES } from '@/constants/documents';
import { FolderOpen } from 'lucide-react';

export default function DocumentUploadView() {
  const navigate = useNavigate();
  const [category, setCategory] = React.useState<string>(DOCUMENT_CATEGORIES[0]);
  const [applicationId] = React.useState('LAP-2026-0184');
  const [documents, setDocuments] = React.useState<DocumentSummary[]>([]);
  const [justUploaded, setJustUploaded] = React.useState(false);

  const fetchDocuments = React.useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch {
      // Non-fatal: checklist defaults to "Required" until the next refresh.
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

  const handleUploadComplete = () => {
    setJustUploaded(true);
    fetchDocuments();
    window.dispatchEvent(new CustomEvent('document:uploaded'));
  };

  const statusFor = (cat: string): 'Complete' | 'Required' =>
    documents.some((d) => d.category === cat) ? 'Complete' : 'Required';

  const completedCount = DOCUMENT_CATEGORIES.filter(
    (c) => statusFor(c) === 'Complete',
  ).length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Document upload</p>
        <h1 className="page-title">Document upload</h1>
        <p className="page-sub">
          Add files securely to {applicationId}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Upload to {applicationId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Document category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <FileDropzone
              applicationId={applicationId}
              category={category}
              onUploadComplete={handleUploadComplete}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Required categories</h3>
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{DOCUMENT_CATEGORIES.length} complete
                </span>
              </div>
              <div className="divide-y divide-border">
                {DOCUMENT_CATEGORIES.map((c) => {
                  const status = statusFor(c);
                  const count = documents.filter((d) => d.category === c).length;
                  return (
                    <SectionRow key={c} title={c} description={count > 0 ? `${count} file${count > 1 ? 's' : ''}` : undefined}>
                      <span
                        className={
                          status === 'Complete'
                            ? 'text-xs font-medium text-emerald-600'
                            : 'text-xs font-medium text-muted-foreground'
                        }
                      >
                        {status}
                      </span>
                    </SectionRow>
                  );
                })}
              </div>
            </div>

            {justUploaded && (
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3">
                <span className="text-sm text-foreground">
                  Your documents were uploaded and are now in the vault.
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setJustUploaded(false);
                    navigate('/dashboard/vault');
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                  View in vault
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <b className="text-foreground">☁ Storage safeguards</b>
          <br />
          <br />
          Use short-lived pre-signed upload URLs. Show upload, malware scan, and document
          verification as separate states. Keep version, uploader, time, and application ID
          in the audit trail.
        </aside>
      </div>
    </div>
  );
}
