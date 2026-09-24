import nextEnv from "@next/env";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import path from "node:path";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:")) throw new Error("This migration helper requires a local SQLite DATABASE_URL.");
const database = path.resolve("prisma", url.slice(5));
if (existsSync(database)) {
  const connection = new DatabaseSync(database);
  const backup = database + ".backup-" + new Date().toISOString().replace(/[:.]/g, "-");
  connection.exec("VACUUM INTO '" + backup.replaceAll("'", "''") + "'");
  connection.close();
  console.info("Created a consistent SQLite backup alongside the database.");
}
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
