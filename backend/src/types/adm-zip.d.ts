declare module 'adm-zip' {
  class AdmZip {
    constructor(filePath?: string);
    getEntries(): ZipEntry[];
    extractAllTo(targetPath: string, overwrite: boolean): void;
    readAsText(entryName: string): string;
    getEntry(entryName: string): ZipEntry | null;
  }

  interface ZipEntry {
    entryName: string;
    name: string;
    isDirectory: boolean;
    getData(): Buffer;
    header: {
      size: number;
      compressedSize: number;
    };
  }

  export default AdmZip;
}
