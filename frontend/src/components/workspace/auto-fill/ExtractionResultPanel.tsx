import * as React from 'react';
import { useState } from 'react';
import { Code2, ChevronDown, ChevronRight } from 'lucide-react';
import type { ExtractAllResult } from '@/services/autoFill';

interface Props {
  result: ExtractAllResult | null;
}

export function ExtractionResultPanel({ result }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Code2 className="h-4 w-4 text-slate-500" />
          Extraction result JSON
        </span>
        <span className="text-xs font-normal text-slate-500">
          {result.processedDocuments}/{result.totalDocuments} docs · {Object.keys(result.extractedFields).length} fields · {result.cacheStatus}
        </span>
      </button>
      {expanded && (
        <pre className="max-h-80 overflow-auto border-t border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
          {JSON.stringify(
            {
              cacheStatus: result.cacheStatus,
              totalDocuments: result.totalDocuments,
              processedDocuments: result.processedDocuments,
              fieldsByStep: result.fieldsByStep,
              documents: result.documents,
            },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}
