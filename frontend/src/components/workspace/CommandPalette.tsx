import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const commands: Command[] = React.useMemo(
    () => [
      {
        id: 'overview',
        label: 'Go to Dashboard',
        group: 'Navigate',
        keywords: 'dashboard home summary',
        run: () => navigate('/dashboard'),
      },
      {
        id: 'applications',
        label: 'Go to Applications',
        group: 'Navigate',
        keywords: 'list loans requests',
        run: () => navigate('/dashboard/applications'),
      },
      {
        id: 'upload',
        label: 'Go to Document upload',
        group: 'Navigate',
        keywords: 'files attach s3',
        run: () => navigate('/dashboard/documents'),
      },
      {
        id: 'vault',
        label: 'Go to S3 document vault',
        group: 'Navigate',
        keywords: 'files storage documents',
        run: () => navigate('/dashboard/vault'),
      },
      {
        id: 'new',
        label: 'Start new application',
        group: 'Actions',
        keywords: 'create add loan request',
        run: () => navigate('/dashboard/applications/new'),
      },
      {
        id: 'upload-action',
        label: 'Upload documents',
        group: 'Actions',
        keywords: 'files attach',
        run: () => navigate('/dashboard/documents'),
      },
    ],
    [navigate],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.keywords ?? ''}`.toLowerCase().includes(q),
    );
  }, [query, commands]);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    setActive((a) => Math.min(a, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!open) return null;

  const execute = (cmd: Command) => {
    cmd.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) execute(filtered[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] animate-fade-in"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to…"
            className="h-12 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="scrollbar-thin max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </p>
          ) : (
            filtered.map((cmd, i) => {
              const showGroup = cmd.group !== lastGroup;
              lastGroup = cmd.group;
              return (
                <div key={cmd.id}>
                  {showGroup && (
                    <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {cmd.group}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => execute(cmd)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm',
                      i === active ? 'bg-primary-50 text-primary-700' : 'text-foreground',
                    )}
                  >
                    <span>{cmd.label}</span>
                    {i === active && (
                      <CornerDownLeft className="h-4 w-4 text-primary-600" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" /> navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1">ESC</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
