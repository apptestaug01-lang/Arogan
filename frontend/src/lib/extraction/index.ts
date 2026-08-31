// Public API for the document -> application auto-fill utility.
export * from './types';
export { FIELD_DEFINITIONS, FIELD_KEYS } from './fields';
export type { FieldDefinition, FieldStrategy } from './fields';
export { extractField } from './heuristics';
export { extractFromTextSources, extractFromTextSourcesWithLlm } from './orchestrate';
export { extractApplicationData, autoFillFromVault } from './extractApplication';
export { classifyDocuments } from './classifyDocuments';
export { extractByDocumentType } from './typeExtractors';
export { normalizeField } from './normalize';
