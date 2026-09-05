function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '_').slice(0, 200)
}

// Layout: borrowers/{clientId}/applications/{applicationId}/documents/{documentId}/{fileName}
export function buildDocumentKey(
  userId: string,
  applicationId: string,
  documentId: string,
  fileName: string,
): string {
  const user = sanitizeSegment(userId)
  const app = sanitizeSegment(applicationId)
  const doc = sanitizeSegment(documentId)
  const file = sanitizeFileName(fileName)
  return `borrowers/${user}/applications/${app}/documents/${doc}/${file}`
}

// Layout: .loanflow/{documentId}/document.json | manifest.json
export function buildArchiveKey(
  documentId: string,
  kind: 'document' | 'manifest' = 'document',
): string {
  const doc = sanitizeSegment(documentId)
  return `.loanflow/${doc}/${kind}.json`
}

// Layout: .loanflow/{documentId}/original.gz  (full-byte recovery copy)
export function buildArchiveOriginalKey(documentId: string): string {
  const doc = sanitizeSegment(documentId)
  return `.loanflow/${doc}/original.gz`
}

// Layout: .loanflow/{documentId}/assets/{assetName}
export function buildArchiveAssetKey(
  documentId: string,
  assetName: string,
): string {
  const doc = sanitizeSegment(documentId)
  const asset = sanitizeFileName(assetName)
  return `.loanflow/${doc}/assets/${asset}`
}
