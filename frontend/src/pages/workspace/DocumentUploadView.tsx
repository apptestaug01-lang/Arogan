import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionRow } from '@/components/workspace/SectionRow';
import { FileDropzone } from '@/components/workspace/FileDropzone';
import { requiredDocs, DocumentItem } from '@/mock/workspace';
import { getExplorer, ExplorerResult } from '@/services/documents';
import { FolderOpen } from 'lucide-react';

const DOCUMENT_CATEGORIES = [
  'KYC',
  'Financials',
  'Bank Statements',
  'Existing Sanction Letters',
  'Other Documents',
  'Property',
  'Stock Statement',
] as const;

function isDocUploaded(docs: DocumentItem[], name: string): boolean {
  return docs.some((d) => d.name.toLowerCase().includes(name.toLowerCase()));
}

export default function DocumentUploadView() {
  const navigate = useNavigate();
  const [category, setCategory] = React.useState<string>(DOCUMENT_CATEGORIES[0]);
  const [applicationId] = React.useState('LAP-2026-0184');
  const [uploadedDocs, setUploadedDocs] = React.useState<DocumentItem[]>([]);
  const [justUploaded, setJustUploaded] = React.useState(false);

  const fetchUploadedDocs = React.useCallback(async () => {
    try {
      const res = await getExplorer();
      const collected: DocumentItem[] = [];

      function collectFiles(result: ExplorerResult) {
        for (const f of result.files) {
          collected.push({
            id: f.documentId || f.key,
            name: f.name,
            meta: f.size ? `${Math.round(f.size / 1024)} KB` : '',
            status: 'Uploaded',
          });
        }
      }
      collectFiles(res);

      for (const folder of res.folders) {
        const sub = await getExplorer(folder.key, undefined).catch(() => null);
        if (sub) {
          collectFiles(sub);
        }
      }

      setUploadedDocs(collected);
    } catch {
      // Non-fatal: required docs status defaults to mock data
    }
  }, []);

  React.useEffect(() => {
    fetchUploadedDocs();
  }, [fetchUploadedDocs]);

  const handleUploadComplete = () => {
    setJustUploaded(true);
    fetchUploadedDocs();
    window.dispatchEvent(new CustomEvent('document:uploaded'));
  };

  const statusFor = (name: string): 'Complete' | 'Required' => {
    return uploadedDocs.length > 0 && isDocUploaded(uploadedDocs, name)
      ? 'Complete'
      : 'Required';
  };

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
              <h3 className="mb-2 text-sm font-semibold text-foreground">Required documents</h3>
              <div className="divide-y divide-border">
                {requiredDocs.map((d) => {
                  const status = statusFor(d.name);
                  return (
                    <SectionRow key={d.id} title={d.name}>
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
