-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL,
    "ownerHash" TEXT NOT NULL,
    "originalIdea" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" TEXT NOT NULL DEFAULT 'QUEUED',
    "completedStagesJson" JSONB NOT NULL DEFAULT '[]',
    "message" TEXT NOT NULL DEFAULT 'Preparing your research',
    "region" TEXT NOT NULL DEFAULT 'worldwide',
    "depth" TEXT NOT NULL DEFAULT 'standard',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "searchAttempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "warningsJson" JSONB NOT NULL DEFAULT '[]',
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),

    CONSTRAINT "Analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchQuery" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "purpose" TEXT NOT NULL,
    "serpApiSearchId" TEXT,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "retainedCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "rawResponseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "searchRunId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT,
    "url" TEXT,
    "source" TEXT,
    "sourceDate" TIMESTAMP(3),
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION,
    "retained" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOf" TEXT,
    "conceptsJson" JSONB NOT NULL DEFAULT '[]',
    "metadataJson" JSONB NOT NULL,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceIdsJson" JSONB NOT NULL,
    "metadataJson" JSONB NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "precision" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "evidenceIdsJson" JSONB NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "detailJson" JSONB NOT NULL,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightEvidence" (
    "insightId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "InsightEvidence_pkey" PRIMARY KEY ("insightId","evidenceId")
);

-- CreateTable
CREATE TABLE "TrendPoint" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "term" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TrendPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchCache" (
    "key" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ResearchGate" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ResearchGate_pkey" PRIMARY KEY ("id")
);

-- Seed the row used to serialize admission/rate-limit transactions.
INSERT INTO "ResearchGate" ("id") VALUES ('global');

-- CreateIndex
CREATE INDEX "Analysis_ownerHash_createdAt_idx" ON "Analysis"("ownerHash", "createdAt");

-- CreateIndex
CREATE INDEX "Analysis_status_updatedAt_idx" ON "Analysis"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SearchQuery_analysisId_idx" ON "SearchQuery"("analysisId");

-- CreateIndex
CREATE INDEX "SearchRun_analysisId_idx" ON "SearchRun"("analysisId");

-- CreateIndex
CREATE INDEX "EvidenceItem_analysisId_retained_type_idx" ON "EvidenceItem"("analysisId", "retained", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_analysisId_normalizedName_type_key" ON "Entity"("analysisId", "normalizedName", "type");

-- CreateIndex
CREATE INDEX "TimelineEvent_analysisId_date_idx" ON "TimelineEvent"("analysisId", "date");

-- CreateIndex
CREATE INDEX "Insight_analysisId_idx" ON "Insight"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "TrendPoint_analysisId_term_date_key" ON "TrendPoint"("analysisId", "term", "date");

-- CreateIndex
CREATE INDEX "SearchCache_expiresAt_idx" ON "SearchCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "SearchQuery" ADD CONSTRAINT "SearchQuery_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchRun" ADD CONSTRAINT "SearchRun_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_searchRunId_fkey" FOREIGN KEY ("searchRunId") REFERENCES "SearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "Insight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightEvidence" ADD CONSTRAINT "InsightEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendPoint" ADD CONSTRAINT "TrendPoint_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

