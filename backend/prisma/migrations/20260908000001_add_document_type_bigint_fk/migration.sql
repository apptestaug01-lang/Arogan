-- AddDocumentTypeBigIntFk
-- Gap 1: Change Document.size from Int to BigInt
-- Gap 2: Add documentType column to Document
-- Gap 14: Add optional relation from Document to Application

ALTER TABLE "Document" ADD COLUMN "documentType" TEXT;

ALTER TABLE "Document" DROP COLUMN "size";
ALTER TABLE "Document" ADD COLUMN "size" BIGINT NOT NULL;
