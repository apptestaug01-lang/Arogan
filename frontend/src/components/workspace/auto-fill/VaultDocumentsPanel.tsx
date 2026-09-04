import * as React from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, FileText, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import {
  listApplicationDocuments,
  type ApplicationDocument,
  type ApplicationDocumentsResponse,
} from '@/services/applicationDocuments';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/constants/documents';

const DOC_TYPE_LABELS: Record<string, string> = {
  PAN_CARD: 'PAN Card',
  AADHAAR: 'Aadhaar',
  GST_CERTIFICATE: 'GST Certificate',
  INCORPORATION_CERT: 'Incorporation Cert',
  ITR: 'ITR',
  BANK_STATEMENT: 'Bank Statement',
  BALANCE_SHEET: 'Balance Sheet',
  SANCTION_LETTER: 'Sanction Letter',
  UNKNOWN: 'Unknown',
};

interface Props {
  applicationId: string;
  refreshKey?: number;
  onDocumentClick?: (doc: ApplicationDocument) => void;
}

function FileIcon({ contentType }: { contentType: string }) {
  const cls = 'h-4 w-4 shrink-0 text-primary-600';
  if (contentType.startsWith('image/')) return <FileText className={cls} />;
  return <FileText className={cls} />;
}

function StatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Ready
      </span>
    );
  }
  if (status === 'failed' || error) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title={error ?? 'Failed'}>
        <AlertCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      <Loader2 className="h-3 w-3" />
      {status}
    </span>
  );
}

export function VaultDocumentsPanel({ applicationId, refreshKey, onDocumentClick }: Props) {
  const [data, setData] = useState<ApplicationDocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocs = React.useCallback(
    async (silent = false) => {
      if (!applicationId) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await listApplicationDocuments(applicationId);
        setData(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load vault';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applicationId],
  );

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading documents from vault…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load vault: {error}
      </div>
    );
  }

  if (!data || data.totalDocuments === 0) {
    return (
      <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">S3 Vault is empty for this application.</p>
        <p className="mt-1">Upload documents first, then come back and click "Auto-Fill from Documents" to extract form fields.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <FileText className="h-4 w-4 text-primary-600" />
          <span>S3 Vault</span>
          <span className="text-xs font-normal text-gray-500">
            {data.totalDocuments} document{data.totalDocuments === 1 ? '' : 's'} · {data.extractedCount} ready
          </span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => fetchDocs(true)}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>
      <ul className="divide-y divide-gray-100">
        {data.documents.map((d) => (
          <li
            key={d.id}
            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <FileIcon contentType={d.contentType} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-800">{d.originalName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {d.extraction?.documentType ? (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                    {DOC_TYPE_LABELS[d.extraction.documentType] ?? d.extraction.documentType}
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">Not classified</span>
                )}
                {d.size != null && <span>{formatBytes(d.size)}</span>}
                {d.extraction?.modelUsed && (
                  <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">{d.extraction.modelUsed}</span>
                )}
              </div>
              {d.extraction?.error && (
                <p className="mt-0.5 truncate text-xs text-red-600" title={d.extraction.error}>
                  ⚠ {d.extraction.error}
                </p>
              )}
            </div>
            <StatusBadge status={d.extraction?.status ?? 'pending'} error={d.extraction?.error ?? null} />
            {onDocumentClick && (
              <button
                type="button"
                onClick={() => onDocumentClick(d)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                title="Open document"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
