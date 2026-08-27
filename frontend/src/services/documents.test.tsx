jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
  },
  setAuthTokens: jest.fn(),
  clearAuthTokens: jest.fn(),
  refreshAccessToken: jest.fn(),
}));

import api from './api';
import {
  presignDocument,
  completeDocument,
  deleteDocument,
  presignMultipart,
  completeMultipart,
  abortMultipart,
  listUploadedParts,
} from './documents';

const mockedApi = api as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  delete: jest.Mock;
  put: jest.Mock;
};

describe('documents service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('presignDocument', () => {
    it('posts to /documents/presign with the input payload', async () => {
      mockedApi.post.mockResolvedValue({
        data: { data: { documentId: 'doc-1', key: 'key-1', uploadUrl: 'https://s3/upload', expiresIn: 300 } },
      });

      const result = await presignDocument({
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/documents/presign', {
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      });
      expect(result.documentId).toBe('doc-1');
      expect(result.uploadUrl).toBe('https://s3/upload');
    });
  });

  describe('completeDocument', () => {
    it('posts to /documents/{id}/complete and returns the document', async () => {
      mockedApi.post.mockResolvedValue({
        data: { data: { document: { id: 'doc-1', applicationId: 'app-1', category: 'Financials', originalName: 'report.pdf', contentType: 'application/pdf', size: 1024, status: 'UPLOADED', createdAt: 'now', updatedAt: 'now' } } },
      });

      const result = await completeDocument({
        documentId: 'doc-1',
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/documents/doc-1/complete', {
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'report.pdf',
        contentType: 'application/pdf',
      });
      expect(result.id).toBe('doc-1');
      expect(result.status).toBe('UPLOADED');
    });
  });

  describe('deleteDocument', () => {
    it('sends a DELETE to /documents/{id}', async () => {
      mockedApi.delete.mockResolvedValue({ data: { success: true } });

      await deleteDocument('doc-1');

      expect(mockedApi.delete).toHaveBeenCalledWith('/documents/doc-1');
    });
  });

  describe('presignMultipart', () => {
    it('posts to /documents/presign-multipart and returns the multipart config', async () => {
      const presignResult = {
        documentId: 'doc-1',
        key: 'key-1',
        uploadId: 'upload-123',
        partUrls: ['https://s3/part1', 'https://s3/part2'],
        partSize: 8388608,
        totalParts: 2,
        concurrency: 4,
        expiresIn: 300,
        abortAfterDays: 7,
      };
      mockedApi.post.mockResolvedValue({ data: { data: presignResult } });

      const result = await presignMultipart({
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        contentLength: 16777216,
      });

      expect(mockedApi.post).toHaveBeenCalledWith('/documents/presign-multipart', {
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        contentLength: 16777216,
      });
      expect(result.uploadId).toBe('upload-123');
      expect(result.totalParts).toBe(2);
      expect(result.partUrls).toHaveLength(2);
    });
  });

  describe('completeMultipart', () => {
    it('posts to /documents/{id}/complete-multipart with parts', async () => {
      mockedApi.post.mockResolvedValue({
        data: {
          data: {
            document: {
              id: 'doc-1',
              applicationId: 'app-1',
              category: 'Financials',
              originalName: 'large.pdf',
              contentType: 'application/pdf',
              size: 16777216,
              status: 'UPLOADED',
              createdAt: 'now',
              updatedAt: 'now',
            },
          },
        },
      });

      const result = await completeMultipart({
        documentId: 'doc-1',
        applicationId: 'app-1',
        category: 'Financials',
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        uploadId: 'upload-123',
        parts: [
          { partNumber: 1, etag: 'etag-1' },
          { partNumber: 2, etag: 'etag-2' },
        ],
      });

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/documents/doc-1/complete-multipart',
        {
          applicationId: 'app-1',
          category: 'Financials',
          fileName: 'large.pdf',
          contentType: 'application/pdf',
          uploadId: 'upload-123',
          parts: [
            { partNumber: 1, etag: 'etag-1' },
            { partNumber: 2, etag: 'etag-2' },
          ],
        },
      );
      expect(result.id).toBe('doc-1');
    });
  });

  describe('abortMultipart', () => {
    it('posts to /documents/multipart/{uploadId}/abort', async () => {
      mockedApi.post.mockResolvedValue({ data: { success: true } });

      await abortMultipart({
        documentId: 'doc-1',
        applicationId: 'app-1',
        fileName: 'large.pdf',
        uploadId: 'upload-123',
      });

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/documents/multipart/upload-123/abort',
        {
          applicationId: 'app-1',
          documentId: 'doc-1',
          fileName: 'large.pdf',
          uploadId: 'upload-123',
        },
      );
    });
  });

  describe('listUploadedParts', () => {
    it('GETs /documents/multipart/{uploadId}/parts with params', async () => {
      mockedApi.get.mockResolvedValue({
        data: { data: { partNumbers: [1, 3] } },
      });

      const result = await listUploadedParts('upload-123', 'app-1', 'doc-1', 'large.pdf');

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/documents/multipart/upload-123/parts',
        { params: { applicationId: 'app-1', documentId: 'doc-1', fileName: 'large.pdf' } },
      );
      expect(result).toEqual([1, 3]);
    });
  });
});
