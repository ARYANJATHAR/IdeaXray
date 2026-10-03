# IdeaXray

IdeaXray searches public web, patent, academic, news, shopping, and trend sources for evidence related to an idea. It saves the search and analysis in PostgreSQL, then presents citations and caveats in a report.

## Deploy to Vercel with Prisma Postgres

The app is configured for PostgreSQL and Vercel. `vercel.json` runs `prisma migrate deploy` before each build, then generates the Prisma Client and builds Next.js. Create separate Prisma Postgres databases for Production and Preview so preview deployments do not apply migrations to production.

1. Push this project to a Git repository and import it into Vercel.
2. In Vercel Marketplace, create a Prisma Postgres database for Production and connect it to the project. Create/connect a separate database for Preview deployments.
3. Add these server-only environment variables in Vercel for Production and Preview as appropriate:
   - `SERPAPI_API_KEY`
   - `AI_PROVIDER=nvidia` and `NVIDIA_API_KEY` (the key is optional if AI summaries are not needed)
   - `APP_URL` set to the canonical HTTPS origin for that environment (for example, your production domain)
   - `DATABASE_URL`, which the Prisma Postgres connection supplies when connected
4. Deploy. The build applies pending Prisma migrations before serving the app. Check `/api/health` after deployment.
5. Submit one real idea, verify the report and PDF, and monitor Vercel function duration and SerpApi/AI provider quotas.

Vercel injects `VERCEL_URL` for deployment-specific URLs; same-origin checks allow that hostname for Preview deployments. Set `APP_URL` for the canonical production domain so secure session cookies work correctly. Never prefix provider keys with `NEXT_PUBLIC_`.

### Background analysis limits

New analyses run in a Next.js `after()` callback with a 300-second function maximum and a 240-second internal analysis deadline. This is suitable for an initial Vercel deployment when the function completes within the limits of the selected Vercel plan. It is not a durable queue: a timeout, platform interruption, or deploy can interrupt a long job. If jobs regularly approach the limit or you need reliable retries, move analysis execution to a durable queue/worker before scaling up.

### Existing local data

The existing `prisma/dev.db` SQLite file is left untouched, but the PostgreSQL migration does not copy its records. The old SQLite migrations are retained under `prisma/sqlite-migrations-archive/` for reference. The hosted Prisma Postgres database starts with the new PostgreSQL schema. If you need to keep old reports, export and migrate them separately before switching your local `.env` to a PostgreSQL `DATABASE_URL`.

## Local development

Requirements: Node.js 22+, npm, a PostgreSQL database, and a SerpApi key. Prisma Postgres can also be used for development; point `DATABASE_URL` in `.env` at a development database.

```powershell
Copy-Item .env.example .env
npm ci
npm run db:migrate
npm run dev
```

`npm run db:migrate` applies committed migrations. Use `npm run db:dev` only when creating a schema change during development. `npm run build` generates Prisma Client and creates a production build. `npm run typecheck` checks TypeScript. `npm test` runs unit tests; database integration tests also run when `TEST_DATABASE_URL` points to a dedicated PostgreSQL test database that has had migrations applied. Keep test and production databases separate.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL; server-only |
| `SERPAPI_API_KEY` | Required search provider credential; server-only |
| `AI_PROVIDER` | Defaults to `nvidia`; `gemini` uses only Gemini. `fallback` opts into NVIDIA then the legacy provider chain. |
| `NVIDIA_API_KEY` | Optional NVIDIA Build credential; server-only |
| `NVIDIA_MODEL` | Comma-separated models tried in order; defaults to Nemotron 3 Ultra, Kimi K3, then Nemotron 3.5 Lightning |
| `NVIDIA_TIMEOUT_MS` | NVIDIA request deadline, default 12000 ms; retries also share the AI task deadline |
| `GEMINI_API_KEY` | Gemini credential; server-only |
| `GEMINI_MODEL` | Gemini model; defaults to `gemini-3.8-flash` |
| `FREEAI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Legacy provider credentials; ignored in NVIDIA and Gemini modes |
| `APP_URL` | Canonical app origin used for origin validation and secure cookies |
| `AI_ENRICHMENT` | Enables optional AI synthesis when a provider key is configured |
| `MAX_SEARCHES_PER_ANALYSIS` | Maximum SerpApi searches per analysis; default 6 |
| `ANALYSIS_TIMEOUT_MS` | Internal analysis deadline; default 240000 ms |
| `RATE_LIMIT_PER_HOUR` | Per-browser-session creation/retry limit |
| `GLOBAL_ANALYSES_PER_HOUR` | Global creation/retry limit |
| `MAX_CONCURRENT_ANALYSES` | Maximum simultaneous active analyses |

Use `.env.example` as a template. Do not commit `.env` or expose credentials to browser code.

### NVIDIA AI

Set `AI_PROVIDER=nvidia` and `NVIDIA_API_KEY` in `.env` or Vercel to select the NVIDIA-hosted OpenAI-compatible API. NVIDIA is the default. Set `AI_PROVIDER=gemini` to switch back to Google. The default model list is `nvidia/nemotron-3-ultra-550b-a55b,moonshotai/kimi-k3,nvidia/nemotron-3.5-lightning-30b-a3b`. For faster responses, put Lightning first or use it alone. Nemotron thinking is disabled and Kimi uses low reasoning effort to fit the research deadline. Responses still undergo JSON schema validation and citation checks; model reasoning content is not displayed.

Checked on 2026-10-03: NVIDIA lists free prototype endpoints for [Nemotron 3 Ultra](https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b), [Kimi K3](https://build.nvidia.com/moonshotai/kimi-k3), and [Nemotron 3.5 Lightning](https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b). These are selected for analytical capability and a faster fallback, not a universal benchmark ranking. Free access is subject to NVIDIA account access, service limits, and trial terms; it is not a production availability guarantee. No live request is verified until you configure a key.

## How a report is created

1. The browser submits an idea to `POST /api/analyses`.
2. The server validates the request, enforces limits, and saves a queued analysis in PostgreSQL.
3. A background callback runs the search pipeline. SerpApi gathers public evidence; optional AI helps plan or summarize it.
4. The app saves sources and progress, then builds a cited report. The browser can reconnect to persisted progress after refreshing.

Source counts represent evidence retained by the app, not total upstream search hits. AI interpretations and relevance filters can miss or misclassify results; review the linked sources yourself. The report is research support, not legal advice or a patentability assessment.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/analyze` | Submit an idea or view its report |
| `POST /api/analyses` | Create and start an analysis |
| `GET /api/analyses/:id` | Read status/report for the owning browser session |
| `GET /api/analyses/:id/events` | Stream analysis progress |
| `GET /api/health` | Check application configuration and database connectivity |

Reports are associated with an anonymous browser session, not a user account. Clearing its cookie or switching browsers can make saved reports inaccessible through the UI. Idea text and search context are sent to configured third-party providers. Define data retention and deletion before inviting the public to use the service.
