import * as React from 'react';
import { X, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getArchiveSummary, getArchiveViewUrl, ArchiveSummary } from '@/services/documents';

const MAX_RAW_CHARS = 500_000;
const TRUNCATION_SUFFIX = '\n…[truncated]';
const MAX_RAW_INPUT = MAX_RAW_CHARS - TRUNCATION_SUFFIX.length;

type Tab = 'summary' | 'content' | 'raw';

interface ArchiveViewerProps {
  documentId: string;
  onClose: () => void;
  onDownloadOriginal: () => void;
}

export function ArchiveViewer({ documentId, onClose, onDownloadOriginal }: ArchiveViewerProps) {
  const [activeTab, setActiveTab] = React.useState<Tab>('summary');
  const [summary, setSummary] = React.useState<ArchiveSummary | null>(null);
  const [contentLoading, setContentLoading] = React.useState(false);
  const [rawLoading, setRawLoading] = React.useState(false);
  const [rawContent, setRawContent] = React.useState<string | null>(null);
  const [viewUrl, setViewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getArchiveSummary(documentId)
      .then(setSummary)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load archive summary'));
  }, [documentId]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'content' && !viewUrl && !contentLoading) {
      setContentLoading(true);
      getArchiveViewUrl(documentId)
        .then((res) => setViewUrl(res.viewUrl))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load archive view'))
        .finally(() => setContentLoading(false));
    }
    if (tab === 'raw' && rawContent === null && !rawLoading) {
      setRawLoading(true);
      getArchiveViewUrl(documentId)
        .then(async (res) => {
          const response = await fetch(res.viewUrl);
          let text = await response.text();
          if (text.length > MAX_RAW_INPUT) {
            text = text.slice(0, MAX_RAW_INPUT) + TRUNCATION_SUFFIX;
          }
          setRawContent(text);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load raw JSON'))
        .finally(() => setRawLoading(false));
    }
  };

  const renderSummary = () => {
    if (!summary) return <p className="p-4 text-sm text-muted-foreground">Loading summary…</p>;

    const statusColor = summary.status === 'COMPLETED' ? 'text-emerald-700' : 'text-amber-700';

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className={`font-medium ${statusColor}`}>{summary.status}</span>
        </div>

        <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
          <span className="text-muted-foreground">Byte tier</span>
          <span>{summary.byteTier ?? '—'}</span>

          <span className="text-muted-foreground">Converter version</span>
          <span>{summary.converterVersion ?? '—'}</span>

          <span className="text-muted-foreground">Source SHA-256</span>
          <span className="font-mono text-xs break-all">{summary.sourceSha256 ?? '—'}</span>

          <span className="text-muted-foreground">Archive key</span>
          <span className="font-mono text-xs break-all">{summary.archiveKey ?? '—'}</span>

          <span className="text-muted-foreground">Created</span>
          <span>{summary.startedAt ?? '—'}</span>

          <span className="text-muted-foreground">Completed</span>
          <span>{summary.completedAt ?? '—'}</span>
        </div>

        {!summary.fidelityVerified && (
          <div className="flex items-start gap-3 rounded-md bg-amber-50 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
            <div>
              <span className="font-medium text-amber-800">Round-trip fidelity not verified</span>
              <p className="mt-1 text-amber-700">
                The archive may have lost layout, table, or cell fidelity. Review warnings below.
              </p>
              {summary.warnings.length > 0 && (
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {summary.error && (
          <div className="rounded-md bg-red-50 p-3 text-sm">
            <span className="font-medium text-red-800">Archive error</span>
            <p className="mt-1 text-red-700">{summary.error.message}</p>
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (contentLoading) {
      return <p className="p-8 text-center text-muted-foreground">Loading archive…</p>;
    }
    if (error) {
      return <p className="p-6 text-center text-danger-500">{error}</p>;
    }
    if (viewUrl) {
      const isPdf = true;
      const isImage = false;
      if (isPdf) {
        return <iframe src={viewUrl} title="Archive content" className="h-[80vh] w-full border-0" />;
      }
      if (isImage) {
        return <img src={viewUrl} alt="Archive content" className="max-w-full max-h-[80vh] object-contain" />;
      }
    }
    return <p className="p-8 text-center text-muted-foreground">No preview available.</p>;
  };

  const renderRaw = () => {
    if (rawLoading) {
      return <p className="p-8 text-center text-muted-foreground">Loading raw JSON…</p>;
    }
    if (error) {
      return <p className="p-6 text-center text-danger-500">{error}</p>;
    }
    if (rawContent) {
      return (
        <pre className="h-[60vh] overflow-auto whitespace-pre-wrap break-all bg-zinc-950/50 p-4 text-sm text-zinc-300">
          {rawContent}
        </pre>
      );
    }
    return null;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'content', label: 'Content' },
    { id: 'raw', label: 'Raw' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative max-w-5xl rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Archive viewer</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-0">
          {activeTab === 'summary' && renderSummary()}
          {activeTab === 'content' && renderContent()}
          {activeTab === 'raw' && renderRaw()}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onDownloadOriginal}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline"
          >
            <Download className="h-4 w-4" />
            Download original
          </button>
        </div>
      </div>
    </div>
  );
}
