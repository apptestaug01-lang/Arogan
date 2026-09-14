import JSZip from 'jszip';
import {
  isAllowedFileType,
  MAX_DOCUMENT_SIZE_BYTES,
} from '@/constants/documents';

export interface ProcessedFile {
  file: File;
  originalName: string;
  size: number;
  relativePath?: string;
}

export function isZipFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip');
}

export async function readEntryAsFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

export async function traverseEntry(
  entry: FileSystemEntry,
  path = '',
): Promise<ProcessedFile[]> {
  if (entry.isFile) {
    const file = await readEntryAsFile(entry as FileSystemFileEntry);
    const relativePath = path ? `${path}/${file.name}` : file.name;
    return [{ file, originalName: file.name, size: file.size, relativePath }];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const results: ProcessedFile[] = [];

    const readAll = (): Promise<FileSystemEntry[]> =>
      new Promise((resolve, reject) => {
        const all: FileSystemEntry[] = [];
        const read = () => {
          reader.readEntries(
            (entries) => {
              if (entries.length === 0) return resolve(all);
              all.push(...entries);
              read();
            },
            reject,
          );
        };
        read();
      });

    const entries = await readAll();
    const folderPath = path ? `${path}/${entry.name}` : entry.name;
    for (const child of entries) {
      const childFiles = await traverseEntry(child, folderPath);
      results.push(...childFiles);
    }
    return results;
  }

  return [];
}

export async function processDroppedItems(
  dataTransfer: DataTransfer,
  isFolderUpload = false,
): Promise<ProcessedFile[]> {
  const items = Array.from(dataTransfer.items);
  const hasEntryAPI = items.length > 0 && typeof items[0].webkitGetAsEntry === 'function';

  if (!hasEntryAPI) {
    return processUploadInput(dataTransfer.files, undefined, isFolderUpload);
  }

  const results: ProcessedFile[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (!entry) continue;
    const files = await traverseEntry(entry);
    results.push(...files);
  }

  const final: ProcessedFile[] = [];
  for (const pf of results) {
    if (isZipFile(pf.file)) {
      const extracted = await extractZipFiles(pf.file);
      final.push(...filterAllowedFiles(extracted));
    } else {
      final.push({
        ...pf,
        relativePath: isFolderUpload ? `${pf.relativePath || ''}` : pf.relativePath,
      });
    }
  }
  return final;
}

export async function extractZipFiles(zipFile: File): Promise<ProcessedFile[]> {
  const arrayBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const processed: ProcessedFile[] = [];

  const zipFiles = Object.keys(zip.files).filter((path) => {
    const zipEntry = zip.files[path];
    return !zipEntry.dir && zipEntry.name.length > 0;
  });

  for (const zipPath of zipFiles) {
    const zipEntry = zip.files[zipPath];
    const blob = await zipEntry.async('blob');
    const file = new File([blob], zipPath.split('/').pop() || zipPath, {
      type: blob.type || 'application/octet-stream',
    });
    Object.defineProperty(file, 'size', { value: blob.size });
    processed.push({
      file,
      originalName: file.name,
      size: file.size,
      relativePath: zipPath,
    });
  }

  return processed;
}

export function getRelativePath(file: File, folderPrefix?: string): string | undefined {
  if (!folderPrefix) return undefined;
  const webkitPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (webkitPath && webkitPath.startsWith(folderPrefix)) {
    return webkitPath.slice(folderPrefix.length);
  }
  return undefined;
}

export function filterAllowedFiles(files: ProcessedFile[]): ProcessedFile[] {
  return files.filter(({ file }) => isAllowedFileType(file));
}

export function validateProcessedFile(item: ProcessedFile): string | null {
  const { file } = item;
  if (!isAllowedFileType(file)) {
    return `File type not allowed: ${file.name}`;
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return `File exceeds 5 GB: ${file.name}`;
  }
  return null;
}

export function deduplicateFiles(files: ProcessedFile[], isFolderUpload = false): ProcessedFile[] {
  const seen = new Set<string>();
  return files.filter(({ file, size, relativePath }) => {
    const key = isFolderUpload ? `${relativePath || ''}-${file.name}-${size}` : `${file.name}-${size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function processUploadInput(
  input: FileList | null,
  folderPrefix?: string,
  isFolderUpload = false,
): Promise<ProcessedFile[]> {
  if (!input || input.length === 0) return [];

  const processed: ProcessedFile[] = [];

  for (let i = 0; i < input.length; i++) {
    const file = input[i];
    if (isZipFile(file)) {
      const extracted = await extractZipFiles(file);
      processed.push(...filterAllowedFiles(extracted));
    } else {
      processed.push({
        file,
        originalName: file.name,
        size: file.size,
        relativePath: isFolderUpload ? `${folderPrefix || ''}/${file.name}` : getRelativePath(file, folderPrefix),
      });
    }
  }

  return processed;
}

const uploadTracker = {
  progress: {} as Record<string, number>,
  status: {} as Record<string, string>,
  updateProgress(uploadId: string, currentProgress: number) {
    this.progress[uploadId] = currentProgress;
  },
  updateStatus(uploadId: string, newStatus: string) {
    this.status[uploadId] = newStatus;
  },
};

export { uploadTracker };
