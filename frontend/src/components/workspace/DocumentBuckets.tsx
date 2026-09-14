import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileJson, Image as ImageIcon, FolderOpen, Download, X } from 'lucide-react';
import { DocumentSummary } from '@/services/documents';
import { useToast } from '@/components/workspace/ToastProvider';
import { getDocumentView } from '@/services/documents';

const STEP_CATEGORIES: Record<string, string> = {
  kyc: 'KYC',
  business: 'Business Details',
  financials: 'Financials',
  loan: 'Loan Request',
};

function DocumentIcon({ contentType }: { contentType?: string }) {
  if (!contentType) return <FileText className="h-5 w-5 text-muted-foreground" />;
  if (contentType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-emerald-600" />;
  if (contentType.includes('pdf')) return <FileText className="h-5 w-5 text-red-600" />;
  if (contentType.includes('json')) return <FileJson className="h-5 w-5 text-amber-600" />;
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return <FileText className="h-5 w-5 text-green-600" />;
  if (contentType.includes('audio')) return <FileText className="h-5 w-5 text-blue-600" />;
  if (contentType.includes('video')) return <FileText className="h-5 w-5 text-purple-600" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

export function getStepCategory(stepKey: string): string {
  return STEP_CATEGORIES[stepKey] ?? stepKey;
}

interface DocumentBucketsProps {
  documents: DocumentSummary[];
  stepKey: string;
  _applicationId?: string;
}

export function DocumentBuckets({ documents, stepKey, _applicationId }: DocumentBucketsProps) {
  const toast = useToast();
  const category = getStepCategory(stepKey);
  const [viewer, setViewer] = React.useState<{ open: boolean; url?: string; title?: string }>({ open: false });

  const bucket = React.useMemo(
    () => documents.filter((d) => d.category === category),
    [documents, category],
  );

  const handleView = async (doc: DocumentSummary) => {
    try {
      const res = await getDocumentView(doc.id);
      setViewer({ open: true, url: res.viewUrl, title: doc.originalName });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load document', 'error');
    }
  };

  if (bucket.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No {category} documents uploaded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bucket.map((doc) => (
        <Card key={doc.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <DocumentIcon contentType={doc.contentType} />
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{doc.originalName}</CardTitle>
                <CardDescription className="truncate">
                  {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : '—'} · {doc.status ?? 'PENDING'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-end gap-2 pb-4">
            <Button variant="ghost" size="sm" onClick={() => handleView(doc)}>
              <FileText className="mr-1 h-4 w-4" />
              View
            </Button>
            <Button variant="ghost" size="sm" onClick={() => toast('Download started', 'success')}>
              <Download className="mr-1 h-4 w-4" />
              Download
            </Button>
          </CardContent>
        </Card>
      ))}

      {viewer.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewer({ open: false })}>
          <div className="relative max-w-4xl rounded-lg bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-semibold text-foreground truncate">{viewer.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setViewer({ open: false })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-0">
              {viewer.url && (
                <iframe src={viewer.url} title={viewer.title} className="h-[70vh] w-full border-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
