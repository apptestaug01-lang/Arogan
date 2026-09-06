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
import { getArchiveSummary, getArchiveViewUrl, ArchiveSummary } from './documents';

const mockedApi = api as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  delete: jest.Mock;
  put: jest.Mock;
};

describe('documents service — archive viewer (C8)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getArchiveSummary', () => {
    it('calls GET /documents/:documentId/archive-summary', async () => {
      const mockSummary: ArchiveSummary = {
        status: 'COMPLETED',
        archiveKey: '.loanflow/doc-1/manifest.json',
        sourceSha256: 'abc123',
        byteTier: 'S',
        converterVersion: '1.0.0',
        fidelityVerified: false,
        warnings: ['test warning'],
        error: null,
        startedAt: '2026-08-20T10:00:00.000Z',
        completedAt: '2026-08-20T10:01:00.000Z',
        updatedAt: '2026-08-20T10:01:00.000Z',
      };
      mockedApi.get.mockResolvedValue({ data: { data: mockSummary } });

      const result = await getArchiveSummary('doc-1');

      expect(mockedApi.get).toHaveBeenCalledWith('/documents/doc-1/archive-summary');
      expect(result).toEqual(mockSummary);
    });

    it('throws on non-2xx response', async () => {
      mockedApi.get.mockRejectedValue(new Error('403 Forbidden'));
      await expect(getArchiveSummary('doc-1')).rejects.toThrow('403 Forbidden');
    });
  });

  describe('getArchiveViewUrl', () => {
    it('calls GET /documents/:documentId/archive-view', async () => {
      mockedApi.get.mockResolvedValue({
        data: { data: { archiveKey: '.loanflow/doc-1/archive.tar.gz', viewUrl: 'https://s3/presigned', expiresIn: 300 } },
      });

      const result = await getArchiveViewUrl('doc-1');

      expect(mockedApi.get).toHaveBeenCalledWith('/documents/doc-1/archive-view');
      expect(result).toEqual({
        archiveKey: '.loanflow/doc-1/archive.tar.gz',
        viewUrl: 'https://s3/presigned',
        expiresIn: 300,
      });
    });
  });
});
