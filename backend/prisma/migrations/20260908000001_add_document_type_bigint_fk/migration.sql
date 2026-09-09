-- AddDocumentTypeBigIntFk
-- Gap 1: Change Document.size from Int to BigInt
-- Gap 2: Add documentType column to Document
-- Gap 14: Add optional relation from Document to Application
-- Fix: make applicationId nullable, add uploadId for session grouping

ALTER TABLE "Document" ADD COLUMN "documentType" TEXT;

ALTER TABLE "Document" DROP COLUMN "size";
ALTER TABLE "Document" ADD COLUMN "size" BIGINT NOT NULL;

ALTER TABLE "Document" ALTER COLUMN "applicationId" DROP NOT NULL;

ALTER TABLE "Document" ADD COLUMN "uploadId" TEXT;

CREATE INDEX "Document_uploadId_idx" ON "Document"("uploadId");
