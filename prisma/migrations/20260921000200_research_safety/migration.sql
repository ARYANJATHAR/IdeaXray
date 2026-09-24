ALTER TABLE "Analysis" ADD COLUMN "leaseExpiresAt" DATETIME;
CREATE TABLE "ResearchGate" ("id" TEXT NOT NULL PRIMARY KEY, "revision" INTEGER NOT NULL DEFAULT 0);
INSERT INTO "ResearchGate" ("id") VALUES ('global');
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EvidenceItem" (
  "id" TEXT NOT NULL PRIMARY KEY, "analysisId" TEXT NOT NULL, "searchRunId" TEXT NOT NULL,
  "type" TEXT NOT NULL, "title" TEXT NOT NULL, "snippet" TEXT, "url" TEXT, "source" TEXT,
  "sourceDate" DATETIME, "relevanceScore" REAL NOT NULL DEFAULT 0, "confidenceScore" REAL,
  "retained" BOOLEAN NOT NULL DEFAULT false, "duplicateOf" TEXT,
  "conceptsJson" TEXT NOT NULL DEFAULT '[]', "metadataJson" TEXT NOT NULL,
  CONSTRAINT "EvidenceItem_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EvidenceItem_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EvidenceItem" SELECT "id", "analysisId", "searchRunId", "type", "title", "snippet", "url", "source", "sourceDate", "relevanceScore", NULL, "retained", "duplicateOf", "conceptsJson", "metadataJson" FROM "EvidenceItem";
DROP TABLE "EvidenceItem";
ALTER TABLE "new_EvidenceItem" RENAME TO "EvidenceItem";
CREATE INDEX "EvidenceItem_analysisId_retained_type_idx" ON "EvidenceItem"("analysisId", "retained", "type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
