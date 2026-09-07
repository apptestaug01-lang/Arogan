import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ArchiveViewer } from '../ArchiveViewer';
import * as documents from '@/services/documents';

jest.mock('@/services/documents', () => ({
  getArchiveSummary: jest.fn(),
  getArchiveViewUrl: jest.fn(),
}));

const mockedSummary = documents.getArchiveSummary as jest.Mock;
const mockedViewUrl = documents.getArchiveViewUrl as jest.Mock;

describe('ArchiveViewer', () => {
  const onClose = jest.fn();
  const onDownloadOriginal = jest.fn();

  const summary = {
    status: 'COMPLETED',
    archiveKey: '.loanflow/doc-1/manifest.json',
    sourceSha256: 'abc123',
    byteTier: 'S',
    converterVersion: '1.0.0',
    fidelityVerified: false,
    warnings: ['cell style lost'],
    error: null,
    startedAt: '2026-08-20T10:00:00.000Z',
    completedAt: '2026-08-20T10:01:00.000Z',
    updatedAt: '2026-08-20T10:01:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSummary.mockResolvedValue(summary);
    mockedViewUrl.mockResolvedValue({
      archiveKey: '.loanflow/doc-1/archive.tar.gz',
      viewUrl: 'https://s3/presigned',
      expiresIn: 300,
    });
    global.fetch = jest.fn().mockResolvedValue({
      text: () => Promise.resolve(JSON.stringify({ data: 'x'.repeat(600000) })),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders Summary tab by default and shows fidelity warning when fidelityVerified is false', async () => {
    render(<ArchiveViewer documentId="doc-1" onClose={onClose} onDownloadOriginal={onDownloadOriginal} />);

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(await screen.findByText(/round-trip fidelity/i)).toBeInTheDocument();
    expect(screen.getByText(/cell style lost/)).toBeInTheDocument();
  });

  it('switches to Content tab and lazy-loads the archive view URL', async () => {
    render(<ArchiveViewer documentId="doc-1" onClose={onClose} onDownloadOriginal={onDownloadOriginal} />);

    await screen.findByText(/round-trip fidelity/i);
    fireEvent.click(screen.getByText('Content'));

    await waitFor(() => {
      expect(mockedViewUrl).toHaveBeenCalledWith('doc-1');
    });
  });

  it('switches to Raw tab and caps JSON at MAX_RAW_CHARS characters', async () => {
    render(<ArchiveViewer documentId="doc-1" onClose={onClose} onDownloadOriginal={onDownloadOriginal} />);

    await screen.findByText(/round-trip fidelity/i);
    fireEvent.click(screen.getByText('Raw'));

    expect(await screen.findByText(/Loading raw JSON/i)).toBeInTheDocument();

    await waitFor(() => {
      const pre = document.querySelector('pre');
      expect(pre).toBeTruthy();
      expect(pre!.textContent!.length).toBeLessThanOrEqual(500000);
    });
  });

  it('renders tabs and calls onClose when close button is clicked', async () => {
    render(<ArchiveViewer documentId="doc-1" onClose={onClose} onDownloadOriginal={onDownloadOriginal} />);

    await screen.findByText(/round-trip fidelity/i);
    fireEvent.click(screen.getByLabelText('Close viewer'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Download Original button which calls onDownloadOriginal', async () => {
    render(<ArchiveViewer documentId="doc-1" onClose={onClose} onDownloadOriginal={onDownloadOriginal} />);

    await screen.findByText(/round-trip fidelity/i);
    fireEvent.click(screen.getByText('Download original'));
    expect(onDownloadOriginal).toHaveBeenCalled();
  });
});
