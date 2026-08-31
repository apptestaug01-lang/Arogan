import * as React from 'react';
import axios, { AxiosError, AxiosProgressEvent } from 'axios';
import { UploadCloud, X, Trash2, CheckCircle2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  formatFileSizeDisplay,
  getContentTypeForFile,
  MULTIPART_THRESHOLD_BYTES,
  MULTIPART_CONCURRENCY,
} from '@/constants/documents';
import {
  processUploadInput,
  validateProcessedFile,
  deduplicateFiles,
  ProcessedFile,
} from '@/lib/upload/fileProcessor';

export interface FileDropzoneProps {
  applicationId?: string;
  onUploadComplete?: () => void;
  className?: string;
  existingDocs?: { originalName: string; size: number | null }[];
}

export interface FileDropzoneHandle {
  openPicker: () => void;
  cancelAll: () => void;
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
  relativePath?: string;
}

const ACCEPTED_EXT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.zip';

function getUploadErrorMessage(error: unknown, _fileName: string): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError
    const data = axiosError.response?.data as Record<string, unknown> | undefined
    const status = axiosError.response?.status

    if (status === 400 && typeof data?.message === 'string') {
      return data.message
    }
    if (status === 413) {
      return 'File is too large to upload'
    }
    if (status === 415) {
      return 'Unsupported file type'
    }
    if (status === 503) {
      return 'Storage is temporarily unavailable. Please try again.'
    }
    if (!axiosError.response) {
      return 'Network error. Please check your connection and try again.'
    }
    if (typeof data?.message === 'string') {
      return data.message
    }
    if (typeof status === 'number' && status >= 500) {
      return 'Server error. Please try again later.'
    }
    return axiosError.message || 'Upload failed'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Upload failed'
}

export const FileDropzone = React.forwardRef<FileDropzoneHandle, FileDropzoneProps>(
  function FileDropzone(
    { applicationId = 'LAP-2026-0184', onUploadComplete, className, existingDocs }: FileDropzoneProps,
    ref: React.ForwardedRef<FileDropzoneHandle>,
  ) {
  const [dragging, setDragging] = React.useState(false);
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);
  const toast = useToast();

  const existingDocsRef = React.useRef(existingDocs);
  React.useEffect(() => {
    existingDocsRef.current = existingDocs;
  }, [existingDocs]);

  const updateItem = React.useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    );
  }, []);

  const removeItem = React.useCallback((id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const addUploadItems = React.useCallback((files: ProcessedFile[]) => {
    const validFiles = deduplicateFiles(files);
    const now = Date.now();
    const items: UploadItem[] = validFiles.map((pf, index) => {
      const isMultipart = pf.file.size > MULTIPART_THRESHOLD_BYTES;
      return {
        id: `${pf.file.name}-${now}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        file: pf.file,
        status: 'idle',
        progress: 0,
        isMultipart,
        totalParts: 1,
        uploadedParts: 0,
        abortController: null,
        relativePath: pf.relativePath,
      };
    });

    setUploads((prev) => [...prev, ...items]);

    items.forEach((item) => {
      const err = validateProcessedFile({ file: item.file, originalName: item.file.name, size: item.file.size });
      if (err) {
        toast(`${item.file.name}: ${err}`, 'error');
        removeItem(item.id);
        return;
      }
    });

    return items;
  }, [toast, removeItem]);

  const uploadSingle = React.useCallback(
    async (item: UploadItem) => {
      const { file, id } = item;
      const contentType = file.type || getContentTypeForFile(file.name) || 'application/octet-stream';
      try {
        updateItem(id, { status: 'presigning', message: 'Requesting upload URL…' });

        const presign = await presignDocument({
          applicationId,
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
        const msg = getUploadErrorMessage(e, file.name);
        updateItem(id, { status: 'error', error: msg, message: undefined });
        toast(`${file.name}: ${msg}`, 'error');
      }
    },
    [applicationId, updateItem, toast],
  );

  const uploadMultipart = React.useCallback(
    async (item: UploadItem) => {
      const { file, id } = item;
      const contentType = file.type || getContentTypeForFile(file.name) || 'application/octet-stream';
      let uploadId: string | undefined;
      let presignResult: PresignMultipartResult | undefined;

      try {
        updateItem(id, { status: 'presigning', message: 'Requesting upload URL…' });

        presignResult = await presignMultipart({
          applicationId,
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
              fileName: item.file.name,
              uploadId,
            });
          } catch {
            // best-effort abort
          }
        }
        const msg = getUploadErrorMessage(e, item.file.name);
        updateItem(id, { status: 'error', error: msg, message: undefined });
        toast(`${item.file.name}: ${msg}`, 'error');
      }
    },
    [applicationId, updateItem, toast],
  );

  const startUpload = React.useCallback(
    (item: UploadItem) => {
      const isDuplicate = existingDocsRef.current?.some(
        (d) => d.originalName === item.file.name && d.size != null && d.size === item.file.size,
      );
      if (isDuplicate) {
        toast(`${item.file.name} already exists`, 'info');
        removeItem(item.id);
        return;
      }

      setTimeout(() => {
        const fn = item.isMultipart ? uploadMultipart : uploadSingle;
        fn(item);
      }, 0);
    },
    [toast, uploadSingle, uploadMultipart, removeItem],
  );

  const handleFiles = React.useCallback(
    async (list: FileList | null, firstFilePath?: string) => {
      if (!list || list.length === 0) return;
      const folderPrefix = firstFilePath
        ? (() => {
            const firstSlash = firstFilePath.indexOf('/')
            return firstSlash >= 0 ? firstFilePath.substring(0, firstSlash + 1) : ''
          })()
        : undefined
      const processed = await processUploadInput(list, folderPrefix)
      const items = addUploadItems(processed)
      items.forEach(startUpload)
    },
    [addUploadItems, startUpload],
  )

  const cancelUpload = React.useCallback(
    (item: UploadItem) => {
      item.abortController?.abort();
      if (item.isMultipart && item.uploadId) {
        abortMultipart({
          documentId: item.documentId || '',
          applicationId,
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
      startUpload(item);
    },
    [removeItem, startUpload],
  );

  const cancelAll = React.useCallback(() => {
    setUploads((prev) => {
      prev.forEach((u) => {
        if (u.status === 'uploading' || u.status === 'presigning' || u.status === 'completing') {
          u.abortController?.abort();
          if (u.isMultipart && u.uploadId && u.documentId) {
            abortMultipart({
              documentId: u.documentId,
              applicationId,
              fileName: u.file.name,
              uploadId: u.uploadId,
            }).catch(() => {});
          }
        }
      });
      return prev.map((u) =>
        u.status === 'uploading' || u.status === 'presigning' || u.status === 'completing'
          ? { ...u, status: 'idle', message: 'Cancelled', error: undefined }
          : u,
      );
    });
  }, [applicationId]);

  React.useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
    }
  }, []);

  React.useImperativeHandle(ref, () => ({ openPicker: () => fileInputRef.current?.click(), cancelAll }), [cancelAll]);

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

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex min-h-40 flex-col items-center justify-center rounded-xl border-2 border-dashed text-center',
          dragging ? 'border-primary-600 bg-primary-50' : 'border-border bg-muted/50',
        )}
      >
        <UploadCloud className="h-8 w-8 text-primary-600" />
        <p className="mt-3 font-semibold text-foreground">Drop files here, or browse</p>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, PNG, JPG, WEBP, DOC, DOCX, XLS, XLSX · Up to 5 GB per file · ZIP and folders supported
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-md border border-input px-3 py-2 text-sm text-primary-600 hover:bg-accent"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose files
          </button>
          <button
            type="button"
            className="rounded-md border border-input px-3 py-2 text-sm text-primary-600 hover:bg-accent"
            onClick={() => folderInputRef.current?.click()}
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4" />
              Choose folder
            </span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, e.target.files?.[0]?.webkitRelativePath)}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.some((u) => u.status === 'uploading' || u.status === 'presigning') && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={cancelAll} aria-label="Cancel all uploads">
                Cancel All
              </Button>
            </div>
          )}
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
});

interface UploadRowProps {
  item: UploadItem;
  onCancel: () => void;
  onRestart: () => void;
  onRemove: () => void;
}

function UploadRow({ item, onCancel, onRestart, onRemove }: UploadRowProps) {
  const { file, status, progress, message, error, isMultipart, uploadedParts, totalParts, relativePath } = item;

  const statusLabel = status === 'complete' ? 'Complete' : message || formatFileSizeDisplay(file);
  const showProgress = status === 'presigning' || status === 'uploading' || status === 'completing';

  return (
    <SectionRow
      title={relativePath ? `${relativePath} → ${file.name}` : file.name}
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
