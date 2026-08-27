import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentViewer } from '@/components/workspace/DocumentViewer';

jest.mock('@/services/documents', () => ({
  getDocumentView: jest.fn(),
}));

jest.mock('./renderPdf', () => ({
  loadPdfDocument: jest.fn(),
  renderPdfPage: jest.fn(),
}));

import { getDocumentView } from '@/services/documents';
import { loadPdfDocument, renderPdfPage } from './renderPdf';

beforeEach(() => {
  (getDocumentView as jest.Mock).mockReset();
  (loadPdfDocument as jest.Mock).mockResolvedValue({ numPages: 3, getPage: jest.fn() });
  (renderPdfPage as jest.Mock).mockResolvedValue(undefined);
});

describe('DocumentViewer', () => {
  it('renders a PDF with page navigation', async () => {
    (getDocumentView as jest.Mock).mockResolvedValue({
      documentId: 'doc-1',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      size: 2048,
      status: 'UPLOADED',
      viewUrl: 'https://signed/report.pdf',
      expiresIn: 300,
    });

    render(<DocumentViewer documentId="doc-1" onClose={jest.fn()} />);

    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('renders an image preview for image content types', async () => {
    (getDocumentView as jest.Mock).mockResolvedValue({
      documentId: 'doc-2',
      fileName: 'logo.png',
      contentType: 'image/png',
      size: 512,
      status: 'UPLOADED',
      viewUrl: 'https://signed/logo.png',
      expiresIn: 300,
    });

    render(<DocumentViewer documentId="doc-2" />);
    const img = await screen.findByRole('img', { name: 'logo.png' });
    expect(img).toHaveAttribute('src', 'https://signed/logo.png');
  });

  it('offers a download link for unsupported content types', async () => {
    (getDocumentView as jest.Mock).mockResolvedValue({
      documentId: 'doc-3',
      fileName: 'notes.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 1024,
      status: 'UPLOADED',
      viewUrl: 'https://signed/notes.docx',
      expiresIn: 300,
    });

    render(<DocumentViewer documentId="doc-3" />);
    const link = await screen.findByRole('link', { name: /Download notes\.docx/i });
    expect(link).toHaveAttribute('href', 'https://signed/notes.docx');
  });

  it('surfaces an error when the view request fails', async () => {
    (getDocumentView as jest.Mock).mockRejectedValue(new Error('Document not found'));

    render(<DocumentViewer documentId="missing" />);
    expect(await screen.findByText('Document not found')).toBeInTheDocument();
  });

  it('requests the presigned view url for the document id', async () => {
    (getDocumentView as jest.Mock).mockResolvedValue({
      documentId: 'doc-1',
      fileName: 'report.pdf',
      contentType: 'application/pdf',
      size: 1,
      status: 'UPLOADED',
      viewUrl: 'https://signed/report.pdf',
      expiresIn: 300,
    });

    render(<DocumentViewer documentId="doc-1" />);
    await waitFor(() => expect(getDocumentView).toHaveBeenCalledWith('doc-1'));
  });
});
