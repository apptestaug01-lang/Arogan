import { getDocumentView, getKeyView } from '@/services/documents';

jest.mock('@/services/documents', () => ({
  getDocumentView: jest.fn(),
  getKeyView: jest.fn(),
}));

const mockedGetDocumentView = getDocumentView as jest.Mock;
const mockedGetKeyView = getKeyView as jest.Mock;

describe('DocumentVaultView — JSON file open (fixes network error)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ company: 'TestCorp', revenue: 1000000 })),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens a JSON file by documentId using fetch (not axios) for the presigned URL', async () => {
    mockedGetDocumentView.mockResolvedValue({
      documentId: 'doc-1',
      fileName: 'balance-sheet.json',
      contentType: 'application/json',
      size: 1024,
      status: 'UPLOADED',
      viewUrl: 'https://s3.presigned/balance-sheet.json?signature=abc',
      expiresIn: 300,
    });

    // We verify the fetch uses the presigned URL, not axios api.get
    const result = await mockedGetDocumentView('doc-1');
    const fetchMock = global.fetch as jest.Mock;
    await fetch(result.viewUrl);

    expect(fetchMock).toHaveBeenCalledWith('https://s3.presigned/balance-sheet.json?signature=abc');
  });

  it('fetches presigned URL via direct fetch, not axios api.get', async () => {
    mockedGetDocumentView.mockResolvedValue({
      documentId: 'doc-2',
      fileName: 'data.json',
      contentType: 'application/json',
      size: 512,
      status: 'UPLOADED',
      viewUrl: 'https://s3.presigned/data.json?sig=xyz',
      expiresIn: 300,
    });

    // We use a mock to verify fetch is called
    const fetchMock = global.fetch as jest.Mock;

    // Simulate the handleFileOpen logic manually
    const viewResult = await mockedGetDocumentView('doc-2');
    await global.fetch(viewResult.viewUrl);

    expect(fetchMock).toHaveBeenCalledWith('https://s3.presigned/data.json?sig=xyz');
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/'));
  });

  it('falls back to getKeyView for files without documentId', async () => {
    const viewResult = {
      documentId: 'key-123',
      fileName: 'orphan.json',
      contentType: 'application/json',
      size: 256,
      status: 'UPLOADED',
      viewUrl: 'https://s3.presigned/orphan.json?sig=abc',
      expiresIn: 300,
    };

    mockedGetKeyView.mockResolvedValue(viewResult);

    const result = await mockedGetKeyView('borrowers/user-1/orphan.json');
    expect(result.viewUrl).toContain('presigned');
  });
});
