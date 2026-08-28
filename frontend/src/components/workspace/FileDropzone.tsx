import * as React from 'react';
import axios, { AxiosProgressEvent } from 'axios';
import { UploadCloud, X, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/workspace/ToastProvider';
import { SectionRow } from '@/components/workspace/SectionRow';
import {
  presignDocument,
  completeDocument,
  presignMultipart,
  completeMultipart,
  abortMultipart,
  MultipartPart,
  PresignMultipartResult,
} from '@/services/documents';
import {
  isAllowedFileType,
  formatFileSizeDisplay,
  MAX_DOCUMENT_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  MULTIPART_CONCURRENCY,
} from '@/constants/documents';

export interface FileDropzoneProps {
  applicationId?: string;
  category?: string;
  onUploadComplete?: () => void;
  className?: string;
}

type UploadStatus =
  | 'idle'
  | 'presigning'
  | 'uploading'
  | 'completing'
  | 'complete'
  | 'error';

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  message?: string;
  error?: string;
  isMultipart: boolean;
  uploadId?: string;
  documentId?: string;
  totalParts: number;
  uploadedParts: number;
  abortController: AbortController | null;
}

const ACCEPTED_EXT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx';

export function FileDropzone({
  applicationId = 'LAP-2026-0184',
  category = 'Documents',
  onUploadComplete,
  className,
}: FileDropzoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const toast = useToast();

  const updateItem = React.useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const validateFile = React.useCallback((file: File): string | null => {
    if (!isAllowedFileType(file)) {
      return 'File type not allowed. Supported: PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX';
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return 'File exceeds the 5 GB maximum size';
    }
    return null;
  }, []);

  const uploadSingle = React.useCallback(
    async (item: UploadItem) => {
      const { file, id } = item;
      const contentType = file.type || 'application/octet-stream';
      try {
        updateItem(id, { status: 'presigning', message: 'Requesting upload URL…' });

        const presign = await presignDocument({
          applicationId,
          category,
          fileName: file.name,
          contentType,
          contentLength: file.size,
        });

        updateItem(id, {
          status: 'uploading',
          message: 'Uploading…',
          documentId: presign.documentId,
          progress: 0,
        });

        const controller = new AbortController();
        updateItem(id, { abortController: controller });

        await axios.put(presign.uploadUrl, file, {
          headers: { 'Content-Type': contentType },
          onUploadProgress: (e: AxiosProgressEvent) => {
            if (e.total && e.total > 0) {
              updateItem(id, { progress: Math.round((e.loaded / e.total) * 100) });
            }
          },
          signal: controller.signal,
        });

        updateItem(id, { status: 'completing', message: 'Finalizing…' });

        await completeDocument({
          documentId: presign.documentId,
          applicationId,
          category,
          fileName: file.name,
          contentType,
        });

        updateItem(id, {
          status: 'complete',
          progress: 100,
          message: 'Complete',
          error: undefined,
        });
        toast(`${file.name} uploaded successfully`, 'success');
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          updateItem(id, { status: 'idle', message: 'Cancelled', error: undefined });
          return;
        }
        const msg = e instanceof Error ? e.message : 'Upload failed';
        updateItem(id, { status: 'error', error: msg, message: undefined });
        toast(`${file.name}: ${msg}`, 'error');
      }
    },
    [applicationId, category, updateItem, toast],
  );

  const uploadMultipart = React.useCallback(
    async (item: UploadItem) => {
      const { file, id } = item;
      const contentType = file.type || 'application/octet-stream';
      let uploadId: string | undefined;
      let presignResult: PresignMultipartResult | undefined;

      try {
        updateItem(id, { status: 'presigning', message: 'Requesting upload URL…' });

        presignResult = await presignMultipart({
          applicationId,
          category,
          fileName: file.name,
          contentType,
          contentLength: file.size,
        });

        uploadId = presignResult.uploadId;
        updateItem(id, {
          status: 'uploading',
          message: `Uploading ${presignResult.totalParts} parts…`,
          isMultipart: true,
          uploadId,
          documentId: presignResult.documentId,
          totalParts: presignResult.totalParts,
          uploadedParts: 0,
          progress: 0,
        });

        const controller = new AbortController();
        updateItem(id, { abortController: controller });

        const { partSize, totalParts, partUrls } = presignResult;
        const concurrency = Math.min(MULTIPART_CONCURRENCY, totalParts);
        const partNumbers = Array.from({ length: totalParts }, (_, i) => i + 1);
        const partProgress = new Map<number, number>();
        const etags: MultipartPart[] = [];
        let completedParts = 0;

        const uploadPart = async (partNumber: number): Promise<MultipartPart> => {
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);
          const url = partUrls[partNumber - 1];

          const resp = await axios.put(url, chunk, {
            headers: { 'Content-Type': contentType },
            onUploadProgress: (e: AxiosProgressEvent) => {
              if (e.total && e.total > 0) {
                partProgress.set(partNumber, e.loaded);
                let loaded = 0;
                partProgress.forEach((v) => (loaded += v));
                updateItem(id, {
                  progress: Math.round((loaded / file.size) * 100),
                });
              }
            },
            signal: controller.signal,
          });

          const etagRaw = resp.headers.etag || resp.headers.ETag || '';
          const etag = etagRaw.replace(/"/g, '');

          completedParts++;
          updateItem(id, { uploadedParts: completedParts });

          return { partNumber, etag };
        };

        const workers: Promise<void>[] = [];
        for (let w = 0; w < concurrency; w++) {
          workers.push(
            (async () => {
              while (true) {
                const partNumber = partNumbers.shift();
                if (partNumber === undefined) return;
                const result = await uploadPart(partNumber);
                etags.push(result);
              }
            })(),
          );
        }

        const settled = await Promise.allSettled(workers);
        const rejected = settled.find((r) => r.status === 'rejected');
        if (rejected) {
          throw rejected.reason instanceof Error
            ? rejected.reason
            : new Error('Part upload failed');
        }

        const sortedParts = etags.sort((a, b) => a.partNumber - b.partNumber);
        updateItem(id, { status: 'completing', message: 'Finalizing…' });

        await completeMultipart({
          documentId: presignResult.documentId,
          applicationId,
          category,
          fileName: file.name,
          contentType,
          uploadId: presignResult.uploadId,
          parts: sortedParts,
        });

        updateItem(id, {
          status: 'complete',
          progress: 100,
          message: 'Complete',
          error: undefined,
        });
        toast(`${file.name} uploaded successfully`, 'success');
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          updateItem(id, { status: 'idle', message: 'Cancelled', error: undefined });
          return;
        }
        if (uploadId) {
          try {
            await abortMultipart({
              documentId: presignResult?.documentId || item.documentId || '',
              applicationId,
              category,
              fileName: file.name,
              uploadId,
            });
          } catch {
            // best-effort abort
          }
        }
        const msg = e instanceof Error ? e.message : 'Upload failed';
        updateItem(id, { status: 'error', error: msg, message: undefined });
        toast(`${file.name}: ${msg}`, 'error');
      }
    },
    [applicationId, category, updateItem, toast],
  );

  const startUpload = React.useCallback(
    (file: File) => {
      const err = validateFile(file);
      if (err) {
        toast(`${file.name}: ${err}`, 'error');
        return;
      }

      const isMultipart = file.size > MULTIPART_THRESHOLD_BYTES;
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: UploadItem = {
        id,
        file,
        status: 'idle',
        progress: 0,
        isMultipart,
        totalParts: 1,
        uploadedParts: 0,
        abortController: null,
      };
      setUploads((prev) => [...prev, item]);

      setTimeout(() => {
        const fn = isMultipart ? uploadMultipart : uploadSingle;
        fn(item);
      }, 0);
    },
    [validateFile, toast, uploadSingle, uploadMultipart],
  );

  const handleFiles = React.useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      Array.from(list).forEach(startUpload);
    },
    [startUpload],
  );

  const cancelUpload = React.useCallback(
    (item: UploadItem) => {
      item.abortController?.abort();
      if (item.isMultipart && item.uploadId) {
        abortMultipart({
          documentId: item.documentId || '',
          applicationId,
          category,
          fileName: item.file.name,
          uploadId: item.uploadId,
        }).catch(() => {});
      }
      updateItem(item.id, { status: 'idle', message: 'Cancelled' });
    },
    [applicationId, updateItem],
  );

  const restartUpload = React.useCallback(
    (item: UploadItem) => {
      removeItem(item.id);
      startUpload(item.file);
    },
    [removeItem, startUpload],
  );

  React.useEffect(() => {
    if (uploads.length === 0) return;
    const allDone = uploads.every((u) => u.status === 'complete' || u.status === 'error');
    const hasComplete = uploads.some((u) => u.status === 'complete');
    const hasError = uploads.some((u) => u.status === 'error');
    if (allDone && hasComplete && !hasError && onUploadComplete) {
      const timer = setTimeout(() => {
        setUploads([]);
        onUploadComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [uploads, onUploadComplete]);

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
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed text-center',
          dragging ? 'border-primary-600 bg-primary-50' : 'border-border bg-muted/50',
        )}
      >
        <UploadCloud className="h-8 w-8 text-primary-600" />
        <p className="mt-3 font-semibold text-foreground">Drop files here, or browse</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX · Up to 5 GB per file
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
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              onCancel={() => cancelUpload(item)}
              onRestart={() => restartUpload(item)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface UploadRowProps {
  item: UploadItem;
  onCancel: () => void;
  onRestart: () => void;
  onRemove: () => void;
}

function UploadRow({ item, onCancel, onRestart, onRemove }: UploadRowProps) {
  const { file, status, progress, message, error, isMultipart, uploadedParts, totalParts } = item;

  const statusLabel = status === 'complete' ? 'Complete' : message || formatFileSizeDisplay(file);

  const showProgress = status === 'presigning' || status === 'uploading' || status === 'completing';

  return (
    <SectionRow
      title={file.name}
      description={
        <div className="flex items-center gap-2">
          {isMultipart && uploadedParts > 0 && (
            <span className="text-xs text-muted-foreground">
              Part {uploadedParts}/{totalParts}
            </span>
          )}
          {status === 'error' && error && (
            <span className="text-xs text-danger-500">{error}</span>
          )}
          {status === 'complete' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <span
            className={cn(
              'text-xs font-medium',
              status === 'complete'
                ? 'text-emerald-600'
                : status === 'error'
                ? 'text-danger-500'
                : 'text-muted-foreground',
            )}
          >
            {statusLabel}
          </span>
        </div>
      }
      children={
        <div className="flex items-center gap-2">
          {showProgress && (
            <div className="w-20 rounded bg-muted">
              <div
                className="h-1.5 rounded bg-primary-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {status === 'uploading' && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Cancel upload"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {(status === 'error' || status === 'idle') && (
            <button
              type="button"
              onClick={onRestart}
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label="Retry upload"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      }
    />
  );
}

export default FileDropzone;
