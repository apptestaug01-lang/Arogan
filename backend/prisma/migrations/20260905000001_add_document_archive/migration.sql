-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "derivedAt" TIMESTAMP WITH TIME ZONE;

-- CreateTable
CREATE TABLE "DocumentArchive" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "schemaVersion" TEXT,
    "converterVersion" TEXT,
    "archiveKey" TEXT,
    "sourceSha256" TEXT,
    "sourceEtag" TEXT,
    "sourceSize" INTEGER,
    "byteTier" TEXT,
    "fidelityVerified" BOOLEAN NOT NULL DEFAULT false,
    "warnings" JSONB,
    "assets" JSONB,
    "error" JSONB,
    "startedAt" TIMESTAMP WITH TIME ZONE,
    "completedAt" TIMESTAMP WITH TIME ZONE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentArchive_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentArchive_documentId_key" ON "DocumentArchive"("documentId");

-- CreateIndex
CREATE INDEX "DocumentArchive_status_idx" ON "DocumentArchive"("status");

-- CreateIndex
CREATE INDEX "DocumentArchive_documentId_idx" ON "DocumentArchive"("documentId");
