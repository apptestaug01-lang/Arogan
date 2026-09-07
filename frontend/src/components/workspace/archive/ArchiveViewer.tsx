import * as React from 'react';
import { X, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getArchiveSummary, getArchiveViewUrl, ArchiveSummary } from '@/services/documents';

const MAX_RAW_CHARS = 500_000;
const TRUNCATION_SUFFIX = '\n…[truncated]';
const MAX_RAW_INPUT = MAX_RAW_CHARS - TRUNCATION_SUFFIX.length;

type Tab = 'summary' | 'content' | 'raw';

interface ArchiveBlock {
  kind: 'text' | 'table' | 'image';
  bbox?: [number, number, number, number];
  runs?: Array<{ text: string; font?: string; size?: number; color?: string }>;
  text?: string;
  html?: string;
  rows?: Array<Array<{ t: string; v: string | number }>>;
  asset?: string;
}

interface ArchivePage {
  pageNumber: number;
  width?: number;
  height?: number;
  blocks: ArchiveBlock[];
  ocr: unknown;
}

interface ParsedArchive {
  format: string;
  metadata: Record<string, unknown>;
  pages: ArchivePage[];
  text: { rawText: string; charCount: number; searchable: boolean };
  fields: Record<string, unknown>;
}

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
  const [parsedContent, setParsedContent] = React.useState<ParsedArchive | null>(null);
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
        .then((res) => {
          setViewUrl(res.viewUrl);
          return fetch(res.viewUrl).then((r) => r.json());
        })
        .then((json: ParsedArchive) => setParsedContent(json))
        .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load archive content'))
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

  const renderTextBlock = (block: ArchiveBlock) => {
    if (block.html) {
      return <div dangerouslySetInnerHTML={{ __html: block.html }} className="archive-html-block" />;
    }
    const runs = block.runs ?? [];
    if (runs.length === 0) return null;
    return (
      <span>
        {runs.map((run, i) => {
          const style: React.CSSProperties = {};
          if (run.font) style.fontFamily = run.font;
          if (run.size) style.fontSize = `${run.size / 2}px`;
          if (run.color) style.color = `#${run.color}`;
          return <span key={i} style={style}>{run.text}</span>;
        })}
      </span>
    );
  };

  const renderTableBlock = (block: ArchiveBlock) => {
    const rows = block.rows ?? [];
    if (rows.length === 0) return null;
    return (
      <table className="border-collapse text-sm">
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border px-2 py-1">
                  <span className="text-muted-foreground">{cell.t}</span>: {cell.v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderContent = () => {
    if (contentLoading) {
      return <p className="p-8 text-center text-muted-foreground">Loading archive…</p>;
    }
    if (error) {
      return <p className="p-6 text-center text-danger-500">{error}</p>;
    }
    if (!parsedContent) {
      return <p className="p-8 text-center text-muted-foreground">Select "Content" tab to load structured view.</p>;
    }

    return (
      <div className="p-6 space-y-6">
        {parsedContent.pages.length === 0 ? (
          <p className="text-muted-foreground">No pages in this archive.</p>
        ) : (
          parsedContent.pages.map((page) => (
            <div key={page.pageNumber} className="border border-border rounded-lg p-4 bg-card">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Page {page.pageNumber}</h3>
              <div className="prose prose-sm max-w-none space-y-3">
                {page.blocks.map((block, bi) => {
                  if (block.kind === 'table') {
                    return <div key={bi}>{renderTableBlock(block)}</div>;
                  }
                  if (block.kind === 'image') {
                    return (
                      <div key={bi} className="text-xs text-muted-foreground">
                        [Image asset: {block.asset}]
                      </div>
                    );
                  }
                  return <div key={bi}>{renderTextBlock(block)}</div>;
                })}
              </div>
            </div>
          ))
        )}

        {parsedContent.text && parsedContent.text.searchable && (
          <details className="mt-4">
            <summary className="text-sm font-medium text-muted-foreground cursor-pointer">Extracted text</summary>
            <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground bg-zinc-950/30 p-3 rounded max-h-64 overflow-auto">
              {parsedContent.text.rawText}
            </pre>
          </details>
        )}
      </div>
    );
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
