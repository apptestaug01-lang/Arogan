import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DocumentBuckets } from './DocumentBuckets';
import { listDocuments, DocumentSummary } from '@/services/documents';
import { useToast } from '@/components/workspace/ToastProvider';

const VAULT_STEPS = [
  { key: 'kyc', label: 'KYC' },
  { key: 'business', label: 'Business Documents' },
  { key: 'financials', label: 'Financials' },
  { key: 'loan', label: 'Loan Request' },
];

export function VaultDocumentBuckets({ documents: externalDocuments }: { documents?: DocumentSummary[] }) {
  const toast = useToast();
  const [internalDocuments, setInternalDocuments] = React.useState<DocumentSummary[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(
    () => new Set(VAULT_STEPS.map((s) => s.key)),
  );

  const documents = externalDocuments ?? internalDocuments;

  React.useEffect(() => {
    if (externalDocuments) return;
    let cancelled = false;
    setLoading(true);
    listDocuments()
      .then((docs) => {
        if (!cancelled) setInternalDocuments(docs);
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Failed to load documents', 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [externalDocuments, toast]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {VAULT_STEPS.map((s) => {
        const isExpanded = expanded.has(s.key);
        return (
          <Card key={s.key}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggle(s.key)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{s.label}</CardTitle>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <DocumentBuckets
                    documents={documents}
                    stepKey={s.key}
                  />
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
