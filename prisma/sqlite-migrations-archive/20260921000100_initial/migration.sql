-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerHash" TEXT NOT NULL,
    "originalIdea" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT NOT NULL DEFAULT 'QUEUED',
    "completedStagesJson" TEXT NOT NULL DEFAULT '[]',
    "message" TEXT NOT NULL DEFAULT 'Preparing your research',
    "region" TEXT NOT NULL DEFAULT 'worldwide',
    "depth" TEXT NOT NULL DEFAULT 'standard',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "searchAttempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "warningsJson" TEXT NOT NULL DEFAULT '[]',
    "summaryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchQuery_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "serpApiSearchId" TEXT,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "retainedCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "rawResponseJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchRun_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "searchRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "url" TEXT,
    "source" TEXT,
    "sourceDate" DATETIME,
    "relevanceScore" REAL NOT NULL DEFAULT 0,
    "confidenceScore" REAL NOT NULL DEFAULT 0,
    "retained" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOf" TEXT,
    "conceptsJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT NOT NULL,
    CONSTRAINT "EvidenceItem_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EvidenceItem_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceIdsJson" TEXT NOT NULL,
    "metadataJson" TEXT NOT NULL,
    CONSTRAINT "Entity_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "precision" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "evidenceIdsJson" TEXT NOT NULL,
    CONSTRAINT "TimelineEvent_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "detailJson" TEXT NOT NULL,
    CONSTRAINT "Insight_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InsightEvidence" (
    "insightId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    PRIMARY KEY ("insightId", "evidenceId"),
    CONSTRAINT "InsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InsightEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrendPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "analysisId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "term" TEXT NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "TrendPoint_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "engine" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Analysis_ownerHash_createdAt_idx" ON "Analysis"("ownerHash", "createdAt");
CREATE INDEX "Analysis_status_updatedAt_idx" ON "Analysis"("status", "updatedAt");
CREATE INDEX "SearchQuery_analysisId_idx" ON "SearchQuery"("analysisId");
CREATE INDEX "SearchRun_analysisId_idx" ON "SearchRun"("analysisId");
CREATE INDEX "EvidenceItem_analysisId_retained_type_idx" ON "EvidenceItem"("analysisId", "retained", "type");
CREATE UNIQUE INDEX "Entity_analysisId_normalizedName_type_key" ON "Entity"("analysisId", "normalizedName", "type");
CREATE INDEX "TimelineEvent_analysisId_date_idx" ON "TimelineEvent"("analysisId", "date");
CREATE INDEX "Insight_analysisId_idx" ON "Insight"("analysisId");
CREATE UNIQUE INDEX "TrendPoint_analysisId_term_date_key" ON "TrendPoint"("analysisId", "term", "date");
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");
