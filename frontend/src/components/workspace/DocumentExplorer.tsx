import * as React from 'react';
import { Folder, File as FileIcon, ChevronRight, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getExplorer, ExplorerEntry } from '@/services/documents';

interface DocumentExplorerProps {
  className?: string;
}

type SortKey = 'name' | 'size' | 'modified';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatModified(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export function DocumentExplorer({ className }: DocumentExplorerProps) {
  const [prefix, setPrefix] = React.useState('');
  const [folders, setFolders] = React.useState<ExplorerEntry[]>([]);
  const [files, setFiles] = React.useState<ExplorerEntry[]>([]);
  const [nextToken, setNextToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<SortKey>('name');

  const load = React.useCallback(async (p: string, token?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getExplorer(p || undefined, token);
      setFolders(res.folders);
      setFiles(res.files);
      setNextToken(res.nextToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
      setFolders([]);
      setFiles([]);
      setNextToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load(prefix, undefined);
  }, [prefix, load]);

  const segments = React.useMemo(() => {
    const parts = prefix.split('/').filter(Boolean);
    const acc: { name: string; prefix: string }[] = [];
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}${part}/` : `${part}/`;
      acc.push({ name: part, prefix: cur });
    }
    return acc;
  }, [prefix]);

  const visibleFolders = React.useMemo(
    () =>
      folders.filter((f) => f.name.toLowerCase().includes(query.toLowerCase())),
    [folders, query],
  );

  const visibleFiles = React.useMemo(() => {
    const filtered = files.filter((f) =>
      f.name.toLowerCase().includes(query.toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return (b.size ?? 0) - (a.size ?? 0);
      return (a.lastModified ?? '').localeCompare(b.lastModified ?? '');
    });
  }, [files, query, sort]);

  const loadMore = () => {
    if (!nextToken) return;
    setLoading(true);
    getExplorer(prefix || undefined, nextToken)
      .then((res) => {
        setFolders((prev) => [...prev, ...res.folders]);
        setFiles((prev) => [...prev, ...res.files]);
        setNextToken(res.nextToken);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load more'))
      .finally(() => setLoading(false));
  };

  const isEmpty = !loading && !error && visibleFolders.length === 0 && visibleFiles.length === 0;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Document explorer</CardTitle>
        <nav aria-label="Folder path" className="mt-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button type="button" className="hover:text-foreground" onClick={() => setPrefix('')}>
            Vault
          </button>
          {segments.map((s) => (
            <React.Fragment key={s.prefix}>
              <ChevronRight className="h-3.5 w-3.5" />
              <button type="button" className="hover:text-foreground" onClick={() => setPrefix(s.prefix)}>
                {s.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search in this folder"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search in this folder"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              aria-label="Sort files"
            >
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="modified">Modified</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error && <p className="px-6 py-4 text-sm text-danger-500">{error}</p>}
        {loading && <p className="px-6 py-4 text-sm text-muted-foreground">Loading…</p>}
        {isEmpty && (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">This folder is empty.</p>
        )}
        <div className="divide-y divide-border">
          {visibleFolders.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setPrefix(f.key)}
              className="flex w-full items-center gap-3 px-6 py-3 text-left hover:bg-muted"
            >
              <Folder className="h-5 w-5 text-primary-600" />
              <span className="truncate font-medium text-foreground">{f.name}</span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {visibleFiles.map((f) => (
            <div key={f.key} className="flex w-full items-center gap-3 px-6 py-3">
              <FileIcon className="h-5 w-5 text-muted-foreground" />
              <span className="truncate text-foreground">{f.name}</span>
              <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                {f.size != null ? formatBytes(f.size) : '—'}
                {formatModified(f.lastModified) ? ` · ${formatModified(f.lastModified)}` : ''}
              </span>
            </div>
          ))}
        </div>
        {nextToken && (
          <div className="flex justify-center p-4">
            <Button variant="outline" onClick={loadMore} disabled={loading}>
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DocumentExplorer;
