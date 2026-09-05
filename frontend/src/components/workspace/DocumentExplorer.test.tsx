import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentExplorer } from './DocumentExplorer';
import * as documents from '@/services/documents';

jest.mock('@/services/documents', () => ({
  getExplorer: jest.fn(),
  deleteDocument: jest.fn(),
}));

const mockedGetExplorer = documents.getExplorer as jest.Mock;
const mockedDelete = documents.deleteDocument as jest.Mock;

jest.mock('@/components/workspace/ToastProvider', () => ({
  useToast: () => jest.fn(),
}));

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
    mockedDelete.mockReset();
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
    const entry = {
      name: 'report.pdf',
      type: 'file' as const,
      key: 'borrowers/user-1/applications/app-1/documents/doc-1/report.pdf',
      size: 2048,
      lastModified: '2026-08-20T10:00:00.000Z',
      documentId: 'doc-uuid-1',
    };
    mockedGetExplorer.mockResolvedValue({
      prefix: 'borrowers/user-1/',
      folders: [],
      files: [entry],
      nextToken: null,
    });

    const onFileOpen = jest.fn();
    render(<DocumentExplorer onFileOpen={onFileOpen} />);

    fireEvent.click(await screen.findByText('report.pdf'));
    expect(onFileOpen).toHaveBeenCalledWith(entry);
  });

  it('opens an unprocessed file via onFileOpen (no document record)', async () => {
    const entry = {
      name: 'partial.bin',
      type: 'file' as const,
      key: 'borrowers/user-1/partial.bin',
      size: 10,
    };
    mockedGetExplorer.mockResolvedValue({
      prefix: 'borrowers/user-1/',
      folders: [],
      files: [entry],
      nextToken: null,
    });

    const onFileOpen = jest.fn();
    render(<DocumentExplorer onFileOpen={onFileOpen} />);

    fireEvent.click(await screen.findByText('partial.bin'));
    expect(onFileOpen).toHaveBeenCalledWith(entry);
  });

  it('renders a VERIFIED status badge for processed files', async () => {
    mockedGetExplorer.mockResolvedValue({
      prefix: 'borrowers/user-1/',
      folders: [],
      files: [
        {
          name: 'verified_doc.pdf',
          type: 'file' as const,
          key: 'borrowers/user-1/applications/app-1/documents/doc-1/verified_doc.pdf',
          size: 2048,
          lastModified: '2026-08-20T10:00:00.000Z',
          documentId: 'doc-uuid-1',
          status: 'VERIFIED',
        },
      ],
      nextToken: null,
    });

    render(<DocumentExplorer />);

    expect(await screen.findByText('VERIFIED')).toBeInTheDocument();
  });

  it('opens a confirm dialog and deletes the document on confirm', async () => {
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
          status: 'UPLOADED',
        },
      ],
      nextToken: null,
    });
    mockedDelete.mockResolvedValue(undefined);

    const onDocumentDeleted = jest.fn();
    render(<DocumentExplorer onDocumentDeleted={onDocumentDeleted} />);

    await screen.findByText('report.pdf');

    const deleteButton = screen.getByLabelText('Delete report.pdf');
    fireEvent.click(deleteButton);

    expect(await screen.findByText('Delete document?')).toBeInTheDocument();
    expect(screen.getByText(/will be removed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockedDelete).toHaveBeenCalledWith('doc-uuid-1');
    });
    await waitFor(() => {
      expect(onDocumentDeleted).toHaveBeenCalled();
    });
  });

  it('closes the confirm dialog on Cancel without deleting', async () => {
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
          status: 'UPLOADED',
        },
      ],
      nextToken: null,
    });
    mockedDelete.mockResolvedValue(undefined);

    render(<DocumentExplorer />);

    await screen.findByText('report.pdf');

    fireEvent.click(screen.getByLabelText('Delete report.pdf'));
    expect(await screen.findByText('Delete document?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Delete document?')).not.toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();
  });
});
