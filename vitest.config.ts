import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: { pool: "threads", environment: "node", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], setupFiles: ["tests/setup.ts"], fileParallelism: false, testTimeout: 20000 },
});
