function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120)
}

// Categories come from a controlled dropdown (e.g. "Bank Statements") so we
// keep spaces and hyphens readable in the S3 path instead of collapsing them.
function sanitizeCategory(value: string): string {
  return value.replace(/[^a-zA-Z0-9 _-]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
}

// Layout: borrowers/{clientId}/applications/{applicationId}/documents/{category}/{documentId}/{fileName}
// The clientId folder namespaces every borrower; category folders group the
// uploaded files so each category's documents live together.
export function buildDocumentKey(
  userId: string,
  applicationId: string,
  category: string,
  documentId: string,
  fileName: string,
): string {
  const user = sanitizeSegment(userId)
  const app = sanitizeSegment(applicationId)
  const cat = sanitizeCategory(category)
  const doc = sanitizeSegment(documentId)
  const file = sanitizeFileName(fileName)
  return `borrowers/${user}/applications/${app}/documents/${cat}/${doc}/${file}`
}
