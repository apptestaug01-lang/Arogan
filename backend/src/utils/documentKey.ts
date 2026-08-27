function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

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
