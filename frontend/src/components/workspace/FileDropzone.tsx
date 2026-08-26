import * as React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/workspace/ToastProvider';

interface FileDropzoneProps {
  className?: string;
}

export function FileDropzone({ className }: FileDropzoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const toast = useToast();

  const addFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    toast(`${list.length} file(s) added`, 'info');
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed text-center',
          dragging ? 'border-primary-600 bg-primary-50' : 'border-border bg-muted',
        )}
      >
        <UploadCloud className="h-8 w-8 text-primary-600" />
        <p className="mt-3 font-semibold text-foreground">Drop files here, or browse</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, XLSX, JPG, PNG · Max 25 MB per file
        </p>
        <button
          type="button"
          className="mt-4 rounded-md border border-input px-3 py-2 text-sm text-primary-600 hover:bg-accent"
          onClick={() => inputRef.current?.click()}
        >
          Choose files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">
                {f.size > 0 ? `${(f.size / 1024).toFixed(0)} KB` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
