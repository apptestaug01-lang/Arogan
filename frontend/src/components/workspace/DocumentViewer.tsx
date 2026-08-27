import * as React from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDocumentView, DocumentViewResult } from '@/services/documents';
import { loadPdfDocument, renderPdfPage } from './renderPdf';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface DocumentViewerProps {
  documentId: string;
  onClose?: () => void;
}

function formatBytes(bytes: number): string {
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

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: DocumentViewResult };

export function DocumentViewer({ documentId, onClose }: DocumentViewerProps) {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    getDocumentView(documentId)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: e instanceof Error ? e.message : 'Failed to load document',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate">
            {state.status === 'ready' ? state.data.fileName : 'Document viewer'}
          </CardTitle>
          {state.status === 'ready' && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatBytes(state.data.size)} · {state.data.status}
            </p>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close viewer"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {state.status === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {state.status === 'error' && (
          <p className="text-sm text-danger-500">{state.error}</p>
        )}
        {state.status === 'ready' && <ViewerBody data={state.data} />}
      </CardContent>
    </Card>
  );
}

function ViewerBody({ data }: { data: DocumentViewResult }) {
  if (data.contentType === 'application/pdf') {
    return <PdfView url={data.viewUrl} fileName={data.fileName} />;
  }
  if (data.contentType.startsWith('image/')) {
    return (
      <img
        src={data.viewUrl}
        alt={data.fileName}
        className="max-h-[70vh] w-auto rounded-md border border-border"
      />
    );
  }
  return (
    <a
      href={data.viewUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
    >
      <Download className="h-4 w-4" />
      Download {data.fileName}
    </a>
  );
}

function PdfView({ url, fileName }: { url: string; fileName: string }) {
  const [numPages, setNumPages] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [error, setError] = React.useState<string | null>(null);
  const [rendering, setRendering] = React.useState(true);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pdfRef = React.useRef<PDFDocumentProxy | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setRendering(true);
    setError(null);
    setPage(1);
    loadPdfDocument(url)
      .then((pdf) => {
        if (cancelled) return undefined;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        const canvas = canvasRef.current;
        return canvas ? renderPdfPage(pdf, 1, canvas) : undefined;
      })
      .then(() => {
        if (!cancelled) setRendering(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render PDF');
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  React.useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || numPages === 0) return;
    let cancelled = false;
    setRendering(true);
    renderPdfPage(pdf, page, canvas)
      .then(() => {
        if (!cancelled) setRendering(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to render page');
          setRendering(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, numPages]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {numPages || '?'}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={numPages === 0 || page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary-600 hover:underline"
        >
          Open {fileName}
        </a>
      </div>
      {error && <p className="text-sm text-danger-500">{error}</p>}
      {rendering && !error && (
        <p className="text-sm text-muted-foreground">Rendering…</p>
      )}
      <canvas ref={canvasRef} className="w-full rounded-md border border-border" />
    </div>
  );
}

export default DocumentViewer;
