import { expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

it("migrates existing evidence and preserves insight citations", () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("prisma/migrations/20260921000100_initial/migration.sql", "utf8"));
  sqlite.exec(`
    PRAGMA foreign_keys=ON;
    INSERT INTO Analysis (id,ownerHash,originalIdea,updatedAt) VALUES ('a','owner','test idea',0);
    INSERT INTO SearchRun (id,analysisId,engine,query,paramsJson,purpose,status) VALUES ('r','a','google','test','{}','test','COMPLETED');
    INSERT INTO EvidenceItem (id,analysisId,searchRunId,type,title,confidenceScore,metadataJson) VALUES ('e','a','r','WEB','test title',70,'{}');
    INSERT INTO Insight (id,analysisId,type,title,body,confidence,detailJson) VALUES ('i','a','LANDSCAPE','title','body','low','{}');
    INSERT INTO InsightEvidence (insightId,evidenceId) VALUES ('i','e');
  `);
  sqlite.exec(readFileSync("prisma/migrations/20260921000200_research_safety/migration.sql", "utf8"));
  expect(sqlite.prepare("SELECT confidenceScore FROM EvidenceItem WHERE id='e'").get()).toMatchObject({ confidenceScore: null });
  expect(sqlite.prepare("SELECT COUNT(*) AS n FROM InsightEvidence").get()).toMatchObject({ n: 1 });
  expect(sqlite.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  sqlite.close();
});
