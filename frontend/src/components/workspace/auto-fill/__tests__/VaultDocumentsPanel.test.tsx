import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { VaultDocumentsPanel } from '../VaultDocumentsPanel';
import * as applicationDocuments from '@/services/applicationDocuments';

jest.mock('@/services/applicationDocuments', () => ({
  listApplicationDocuments: jest.fn(),
}));

const mockList = applicationDocuments.listApplicationDocuments as jest.MockedFunction<
  typeof applicationDocuments.listApplicationDocuments
>;

describe('VaultDocumentsPanel', () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it('shows empty state when the vault has no documents', async () => {
    mockList.mockResolvedValue({
      applicationId: 'LAP-test',
      documents: [],
      totalDocuments: 0,
      extractedCount: 0,
      cacheStatus: 'live',
    });

    render(<VaultDocumentsPanel applicationId="LAP-test" />);
    await waitFor(() => {
      expect(screen.getByText(/S3 Vault is empty/i)).toBeInTheDocument();
    });
  });

  it('lists documents with their classification and status', async () => {
    mockList.mockResolvedValue({
      applicationId: 'LAP-test',
      documents: [
        {
          id: 'doc-1',
          originalName: 'pan.pdf',
          contentType: 'application/pdf',
          size: 1024,
          status: 'UPLOADED',
          createdAt: '2026-01-01T00:00:00Z',
          extraction: {
            documentId: 'doc-1',
            documentType: 'PAN_CARD',
            status: 'completed',
            modelUsed: 'cloudflare-llama3',
            error: null,
            extractedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
        {
          id: 'doc-2',
          originalName: 'aadhaar.pdf',
          contentType: 'application/pdf',
          size: 2048,
          status: 'UPLOADED',
          createdAt: '2026-01-01T00:00:00Z',
          extraction: {
            documentId: 'doc-2',
            documentType: 'AADHAAR',
            status: 'completed',
            modelUsed: 'regex',
            error: null,
            extractedAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
      ],
      totalDocuments: 2,
      extractedCount: 2,
      cacheStatus: 'cached',
    });

    render(<VaultDocumentsPanel applicationId="LAP-test" />);
    await waitFor(() => {
      expect(screen.getByText('pan.pdf')).toBeInTheDocument();
    });
    expect(screen.getByText('aadhaar.pdf')).toBeInTheDocument();
    expect(screen.getByText('PAN Card')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar')).toBeInTheDocument();
    expect(screen.getByText(/2 documents? · 2 ready/)).toBeInTheDocument();
  });

  it('shows error message when listing fails', async () => {
    mockList.mockRejectedValue(new Error('network down'));

    render(<VaultDocumentsPanel applicationId="LAP-test" />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load vault: network down/)).toBeInTheDocument();
    });
  });
});
