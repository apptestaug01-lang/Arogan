import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FileDropzone } from './FileDropzone';
import axios from 'axios';
import {
  presignDocument,
  completeDocument,
  presignMultipart,
  completeMultipart,
} from '@/services/documents';
import * as fileProcessor from '@/lib/upload/fileProcessor';

jest.mock('axios', () => ({
  __esModule: true,
  default: { put: jest.fn() },
}));

jest.mock('@/services/documents', () => ({
  presignDocument: jest.fn(),
  completeDocument: jest.fn(),
  presignMultipart: jest.fn(),
  completeMultipart: jest.fn(),
  abortMultipart: jest.fn(),
}));

jest.mock('@/components/workspace/ToastProvider', () => ({
  useToast: () => jest.fn(),
}));

const mockedAxios = axios as unknown as { put: jest.Mock };
const mockedPresign = presignDocument as jest.MockedFunction<typeof presignDocument>;
const mockedComplete = completeDocument as jest.MockedFunction<typeof completeDocument>;
const mockedPresignMulti = presignMultipart as jest.MockedFunction<typeof presignMultipart>;
const mockedCompleteMulti = completeMultipart as jest.MockedFunction<typeof completeMultipart>;
const mockedProcessUpload = jest.spyOn(fileProcessor, 'processUploadInput').mockResolvedValue([]);
const mockedValidate = jest.spyOn(fileProcessor, 'validateProcessedFile').mockReturnValue(null);
const mockedDeduplicate = jest.spyOn(fileProcessor, 'deduplicateFiles').mockImplementation((files) => files);

describe('FileDropzone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPresign.mockResolvedValue({
      documentId: 'doc-uploaded',
      key: 'borrowers/u1/applications/app-1/documents/doc-uploaded/report.pdf',
      uploadUrl: 'https://s3/upload/doc-1',
      expiresIn: 300,
    });
    mockedComplete.mockResolvedValue({
      id: 'doc-uploaded',
      applicationId: 'app-1',
      category: 'Documents',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      size: 1024,
      status: 'UPLOADED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedAxios.put.mockResolvedValue({ headers: { etag: '"etag-1"' } });
    mockedProcessUpload.mockResolvedValue([]);
    mockedValidate.mockReturnValue(null);
    mockedDeduplicate.mockImplementation((files) => files);
  });

  const getInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

  const makeFile = (name: string, sizeBytes: number, type: string): File => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: sizeBytes });
    return file;
  };

  const makeProcessedFile = (name: string, sizeBytes: number, type: string): { file: File; originalName: string; size: number } => {
    const file = makeFile(name, sizeBytes, type);
    return { file, originalName: name, size: sizeBytes };
  };

  it('rejects files with a disallowed extension', async () => {
    const onUploadComplete = jest.fn();
    mockedProcessUpload.mockResolvedValue([
      makeProcessedFile('notes.txt', 100, 'text/plain'),
    ]);
    mockedValidate.mockReturnValue('File type not allowed: notes.txt');

    render(<FileDropzone applicationId="app-1" onUploadComplete={onUploadComplete} />);

    const file = makeFile('notes.txt', 100, 'text/plain');
    fireEvent.change(getInput(), { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedPresign).not.toHaveBeenCalled();
    });
  });

  it('rejects files larger than the maximum size', async () => {
    mockedProcessUpload.mockResolvedValue([]);

    render(<FileDropzone applicationId="app-1" />);

    const fiveGb = 5 * 1024 * 1024 * 1024 + 1;
    const file = makeFile('huge.pdf', fiveGb, 'application/pdf');
    fireEvent.change(getInput(), { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedPresign).not.toHaveBeenCalled();
    });
  });

  it('uploads a small file via presign -> PUT -> complete', async () => {
    const onUploadComplete = jest.fn();
    mockedProcessUpload.mockResolvedValue([
      makeProcessedFile('report.pdf', 1024, 'application/pdf'),
    ]);

    render(
      <FileDropzone
        applicationId="app-1"
        category="Financials"
        onUploadComplete={onUploadComplete}
      />,
    );

    const file = makeFile('report.pdf', 1024, 'application/pdf');
    fireEvent.change(getInput(), { target: { files: [file] } });

    await waitFor(() => {
      expect(mockedPresign).toHaveBeenCalledWith({
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      });
    });

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledWith(
        'https://s3/upload/doc-1',
        file,
        expect.objectContaining({ signal: expect.anything() }),
      );
    });

    await waitFor(() => {
      expect(mockedComplete).toHaveBeenCalledWith({
        documentId: 'doc-uploaded',
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
      });
    });

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled();
    });
  });

  it('uploads a large file via multipart when above the threshold', async () => {
    const onUploadComplete = jest.fn();
    mockedProcessUpload.mockResolvedValue([
      makeProcessedFile('large.pdf', 101 * 1024 * 1024, 'application/pdf'),
    ]);

    render(
      <FileDropzone
        applicationId="app-1"
        category="Financials"
        onUploadComplete={onUploadComplete}
      />,
    );

    const hundredMbPlus = 101 * 1024 * 1024;
    const file = makeFile('large.pdf', hundredMbPlus, 'application/pdf');
    fireEvent.change(getInput(), { target: { files: [file] } });

    mockedPresignMulti.mockResolvedValue({
      documentId: 'doc-mpu',
      key: 'borrowers/u1/documents/doc-mpu/large.pdf',
      uploadId: 'vp-123',
      partUrls: ['https://s3/part/1', 'https://s3/part/2'],
      partSize: 64 * 1024 * 1024,
      totalParts: 2,
      concurrency: 4,
      expiresIn: 300,
      abortAfterDays: 7,
    });
    mockedCompleteMulti.mockResolvedValue({
      id: 'doc-mpu',
      applicationId: 'app-1',
      category: 'Financials',
      originalName: 'large.pdf',
      contentType: 'application/pdf',
      size: hundredMbPlus,
      status: 'UPLOADED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await waitFor(() => {
      expect(mockedPresignMulti).toHaveBeenCalledWith({
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        contentLength: hundredMbPlus,
      });
    });

    await waitFor(() => {
      expect(mockedAxios.put).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(mockedCompleteMulti).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 'doc-mpu',
          uploadId: 'vp-123',
          parts: expect.arrayContaining([
            expect.objectContaining({ partNumber: 1 }),
            expect.objectContaining({ partNumber: 2 }),
          ]),
        }),
      );
    });

    await waitFor(() => {
      expect(onUploadComplete).toHaveBeenCalled();
    });
  });

  it('shows a Cancel button during an active upload', async () => {
    mockedAxios.put.mockReturnValue(new Promise(() => {}));
    mockedProcessUpload.mockResolvedValue([
      makeProcessedFile('report.pdf', 1024, 'application/pdf'),
    ]);

    render(<FileDropzone applicationId="app-1" />);

    const file = makeFile('report.pdf', 1024, 'application/pdf');
    fireEvent.change(getInput(), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByLabelText('Cancel upload')).toBeInTheDocument();
    });
  });
});
