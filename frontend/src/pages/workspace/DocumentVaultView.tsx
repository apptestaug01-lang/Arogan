import * as React from 'react';
import { X, Download, FileJson, FileText } from 'lucide-react';
import { DocumentExplorer } from '@/components/workspace/DocumentExplorer';
import { ExplorerEntry, DocumentViewResult, getDocumentView, getKeyView } from '@/services/documents';
import api from '@/services/api';

interface ViewerState {
  open: boolean;
  entry: ExplorerEntry | null;
  viewResult: DocumentViewResult | null;
  loading: boolean;
  error: string | null;
  jsonContent: string | null;
}

export default function DocumentVaultView() {
  const [viewer, setViewer] = React.useState<ViewerState>({
    open: false,
    entry: null,
    viewResult: null,
    loading: false,
    error: null,
    jsonContent: null,
  });

  const handleFileOpen = React.useCallback(async (entry: ExplorerEntry) => {
    setViewer({
      open: true,
      entry,
      viewResult: null,
      loading: true,
      error: null,
      jsonContent: null,
    });

    try {
      let result: DocumentViewResult;
      if (entry.documentId) {
        result = await getDocumentView(entry.documentId);
      } else {
        result = await getKeyView(entry.key);
      }

      const isJson = entry.name.toLowerCase().endsWith('.json');

      if (isJson) {
        const response = await api.get(result.viewUrl, {
          responseType: 'text',
          baseURL: '',
        });
        let parsed;
        try {
          parsed = JSON.parse(response.data);
        } catch {
          parsed = response.data;
        }
        setViewer((prev) => ({
          ...prev,
          viewResult: result,
          jsonContent: JSON.stringify(parsed, null, 2),
          loading: false,
        }));
      } else {
        setViewer((prev) => ({
          ...prev,
          viewResult: result,
          loading: false,
        }));
      }
    } catch (e) {
      setViewer((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Failed to load document',
        loading: false,
      }));
    }
  }, []);

  const closeViewer = () => {
    setViewer({
      open: false,
      entry: null,
      viewResult: null,
      loading: false,
      error: null,
      jsonContent: null,
    });
  };

  const renderViewerContent = () => {
    if (viewer.loading) {
      return <div className="p-8 text-center text-muted-foreground">Loading document…</div>;
    }
    if (viewer.error) {
      return <div className="p-6 text-center text-danger-500">{viewer.error}</div>;
    }
    if (!viewer.viewResult) return null;

    const isJson = viewer.entry?.name.toLowerCase().endsWith('.json');
    const isPdf = viewer.viewResult.contentType === 'application/pdf';
    const isImage = viewer.viewResult.contentType?.startsWith('image/');

    if (isJson && viewer.jsonContent) {
      return (
        <pre className="h-[60vh] overflow-auto whitespace-pre-wrap break-all bg-zinc-950/50 p-4 text-sm text-zinc-300">
          {viewer.jsonContent}
        </pre>
      );
    }

    if (isPdf) {
      return (
        <iframe
          src={viewer.viewResult.viewUrl}
          title={viewer.viewResult.fileName}
          className="h-[80vh] w-full border-0"
        />
      );
    }

    if (isImage) {
      return (
        <div className="p-4">
          <img
            src={viewer.viewResult.viewUrl}
            alt={viewer.viewResult.fileName}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </div>
      );
    }

    return (
      <div className="p-8 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Preview not available for this file type.
        </p>
        <a
          href={viewer.viewResult.viewUrl}
          download={viewer.viewResult.fileName}
          className="mt-4 inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
        >
          <Download className="h-4 w-4" /> Download {viewer.viewResult.fileName}
        </a>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / S3 document vault</p>
        <h1 className="page-title">S3 document vault</h1>
        <p className="page-sub">
          Browse every document stored for your applications, organized by application.
          Click any file to preview it — JSON files, original documents, and extracted
          structured data are all viewable inline.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <DocumentExplorer onFileOpen={handleFileOpen} />

        <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <b className="text-foreground">🛡 Protected storage</b>
          <br />
          <br />
          Files are stored in S3-compatible object storage. Documents are scoped per
          borrower (<code>borrowers/{'{userId}'}/...</code>). JSON conversion results
          are stored alongside originals as <code>.json</code> siblings.
        </aside>
      </div>

      {viewer.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeViewer}
        >
          <div
            className="relative max-w-5xl rounded-lg bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                {viewer.entry?.name.toLowerCase().endsWith('.json') ? (
                  <FileJson className="h-5 w-5 text-amber-500" />
                ) : (
                  <FileText className="h-5 w-5 text-primary-600" />
                )}
                <h2 className="font-semibold text-foreground">
                  {viewer.viewResult?.fileName || viewer.entry?.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeViewer}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-0">{renderViewerContent()}</div>
          </div>
        </div>
      )}
    </div>
  );
}
