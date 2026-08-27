import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentExplorer } from './DocumentExplorer';
import * as documents from '@/services/documents';

jest.mock('@/services/documents', () => ({
  getExplorer: jest.fn(),
}));

const mockedGetExplorer = documents.getExplorer as jest.Mock;

const ROOT_LISTING = {
  prefix: 'borrowers/user-1/',
  folders: [{ name: 'applications', type: 'folder' as const, key: 'borrowers/user-1/applications/' }],
  files: [
    {
      name: 'report.pdf',
      type: 'file' as const,
      key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
      size: 2048,
      lastModified: '2026-08-20T10:00:00.000Z',
    },
  ],
  nextToken: null,
};

describe('DocumentExplorer', () => {
  beforeEach(() => {
    mockedGetExplorer.mockReset();
  });

  it('renders folders and files returned by the API', async () => {
    mockedGetExplorer.mockResolvedValue(ROOT_LISTING);
    render(<DocumentExplorer />);

    expect(await screen.findByText('applications')).toBeInTheDocument();
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('navigates into a subfolder on folder click (deep link)', async () => {
    mockedGetExplorer.mockResolvedValueOnce(ROOT_LISTING);
    mockedGetExplorer.mockResolvedValueOnce({
      prefix: 'borrowers/user-1/applications/',
      folders: [
        { name: 'documents', type: 'folder' as const, key: 'borrowers/user-1/applications/app-1/documents/' },
      ],
      files: [],
      nextToken: null,
    });

    render(<DocumentExplorer />);
    const folder = await screen.findByText('applications');
    fireEvent.click(folder);

    await waitFor(() =>
      expect(mockedGetExplorer).toHaveBeenLastCalledWith('borrowers/user-1/applications/', undefined),
    );
    expect(await screen.findByText('documents')).toBeInTheDocument();
  });

  it('opens a file that has a document record via onFileOpen', async () => {
    mockedGetExplorer.mockResolvedValue({
      prefix: 'borrowers/user-1/',
      folders: [],
      files: [
        {
          name: 'report.pdf',
          type: 'file' as const,
          key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
          size: 2048,
          lastModified: '2026-08-20T10:00:00.000Z',
          documentId: 'doc-uuid-1',
        },
      ],
      nextToken: null,
    });

    const onFileOpen = jest.fn();
    render(<DocumentExplorer onFileOpen={onFileOpen} />);

    fireEvent.click(await screen.findByText('report.pdf'));
    expect(onFileOpen).toHaveBeenCalledWith('doc-uuid-1');
  });

  it('does not fire onFileOpen for an unprocessed file (no document record)', async () => {
    mockedGetExplorer.mockResolvedValue({
      prefix: 'borrowers/user-1/',
      folders: [],
      files: [
        {
          name: 'partial.bin',
          type: 'file' as const,
          key: 'borrowers/user-1/partial.bin',
          size: 10,
        },
      ],
      nextToken: null,
    });

    const onFileOpen = jest.fn();
    render(<DocumentExplorer onFileOpen={onFileOpen} />);

    fireEvent.click(await screen.findByText('partial.bin'));
    expect(onFileOpen).not.toHaveBeenCalled();
  });
});
