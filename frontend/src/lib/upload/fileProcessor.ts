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

export function deduplicateFiles(files: ProcessedFile[]): ProcessedFile[] {
  const seen = new Set<string>();
  return files.filter(({ file, size }) => {
    const key = `${file.name}-${size}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function processUploadInput(
  input: FileList | null,
  folderPrefix?: string,
): Promise<ProcessedFile[]> {
  if (!input || input.length === 0) return [];

  const rawFiles: File[] = [];
  const zipFiles: File[] = [];

  for (let i = 0; i < input.length; i++) {
    const file = input[i];
    if (isZipFile(file)) {
      zipFiles.push(file);
    } else {
      rawFiles.push(file);
    }
  }

  const processed: ProcessedFile[] = [];

  for (const file of rawFiles) {
    processed.push({
      file,
      originalName: file.name,
      size: file.size,
      relativePath: getRelativePath(file, folderPrefix),
    });
  }

  for (const zipFile of zipFiles) {
    const extracted = await extractZipFiles(zipFile);
    processed.push(...extracted);
  }

  return processed;
}
