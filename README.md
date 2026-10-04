# IdeaXray

**See what happened to your idea.** IdeaXray is a research tool that helps you explore existing inventions, academic research, products, and market activity before developing an idea further.

Describe your idea, choose a research region, and receive a report with related evidence, source links, a timeline, and feature coverage. SerpApi powers the searches; optional AI helps translate the brief into search vocabulary and produce source-backed interpretations.

- **Live website:** [ideaxray.aryanjathar.in](https://ideaxray.aryanjathar.in/)
- **SerpApi India Hackathon 2026 track:** Knowledge & Public Interest

## What you can explore

- **Overview:** evidence counts, idea context, and supported research takeaways when available.
- **Solutions:** related products and web results to help explore what already exists.
- **Patents:** related inventions with links to their original sources.
- **Research:** academic papers and supporting excerpts.
- **History:** dated evidence arranged along a timeline.
- **Opportunities:** coverage across features of the submitted idea, with supporting evidence.
- **Search trace:** search queries, result counts, durations, and statuses.
- **Sources:** searchable evidence with filters by source type.
- **PDF export:** download a formatted research report directly from the browser.

## How SerpApi is used

SerpApi is the project's core source of search data. The server calls its search APIs and turns the structured responses into evidence cards and report sections.

| SerpApi engine | Role in IdeaXray |
| --- | --- |
| `google_patents` | Find related inventions and patent records. |
| `google_scholar` | Find related academic papers. |
| `google` | Discover existing solutions, product pages, and related organizations. |
| `google_shopping` | Retrieve product listings when the brief is identified as a physical product. |
| `google_news` | Find relevant news and recent market activity. |
| `google_trends` | Retrieve available interest-over-time data. |

A standard analysis plans five searches, or six when Shopping is included. Search attempts and retries share a configurable budget of six by default. Cached responses can reduce new upstream requests. The research-region setting affects supported market and trend searches; it does not restrict every search engine to that region.

### Report flow

1. The user submits an idea and selects a region on the analysis page.
2. The server validates the request, checks usage limits, and saves the analysis in PostgreSQL.
3. The brief is converted into search terms. Optional AI planning can improve the vocabulary; keyword planning is available without an AI key.
4. SerpApi retrieves patent, academic, web, news, trend, and applicable shopping results.
5. IdeaXray normalizes the results, removes duplicates, checks relevance, and saves evidence and search progress.
6. The app assembles the report, timeline, and coverage indicators. Optional AI interpretations are checked against supplied source excerpts and citations.
7. The user explores the report and can export it as a PDF. Saved progress can be reloaded from the same browser session.

## Technology

Next.js App Router, React, TypeScript, Tailwind CSS, Tabler Icons, Prisma with PostgreSQL, SerpApi, Zod, and client-side PDF generation with jsPDF and jsPDF-AutoTable. NVIDIA is the default optional AI provider; Gemini and a legacy fallback mode are also supported.

## Run locally

### 1. Prerequisites

- Node.js **22 or newer** and npm.
- A PostgreSQL database. A separate Prisma Postgres development database also works.
- A [SerpApi API key](https://serpapi.com/).
- An NVIDIA API key only if you want the optional AI features.

### 2. Get the project

```sh
git clone https://github.com/ARYANJATHAR/IdeaXray.git
cd IdeaXray
npm ci
```

If you already have the repository, open a terminal in its folder and run `npm ci`.

### 3. Configure the environment

Copy `.env.example` to `.env`.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**

```sh
cp .env.example .env
```

Edit `.env` and replace the placeholders:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
SERPAPI_API_KEY=YOUR_SERPAPI_KEY
APP_URL=http://localhost:3000

AI_PROVIDER=nvidia
NVIDIA_API_KEY=YOUR_NVIDIA_KEY
AI_ENRICHMENT=true
```

Use your database provider's connection string, including its SSL options. For a local PostgreSQL instance, use the connection string appropriate to that instance.

**This code reads `DATABASE_URL`.** If your Vercel database integration provides `POSTGRES_URL`, copy its direct PostgreSQL connection-string value into `DATABASE_URL`. Setting only `POSTGRES_URL` or `PRISMA_DATABASE_URL` does not configure this app. A Prisma Accelerate URL requires additional integration and is not a replacement for the direct PostgreSQL URL in this setup.

To run searches without AI, leave `NVIDIA_API_KEY` empty and set `AI_ENRICHMENT=false`. SerpApi and the database are still required. Keep the model settings from `.env.example`, or set `NVIDIA_MODEL` to models enabled for your account.

### 4. Apply the database schema

```sh
npm run db:migrate
```

This applies the committed PostgreSQL migrations. No seed step is needed: reports are created from submitted ideas and search results.

### 5. Start the application

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Visit [http://localhost:3000/api/health](http://localhost:3000/api/health) to check configuration and database connectivity. The health endpoint does not verify provider API keys by making live requests.

If you use another port, update `APP_URL` to match it and restart the server.

### 6. Try an idea

> A low-cost wearable posture reminder that gently vibrates when a desk worker slouches, works without a smartphone, and has a rechargeable battery.

Continue from the landing page, select a region, and start the analysis. Wait for the report, then explore the tabs and export the PDF. A real analysis uses your SerpApi quota and, when enabled, your AI provider's allowance.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run build` | Generate Prisma Client and build the production app. |
| `npm start` | Serve the production build after building it. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Check TypeScript. |
| `npm test` | Run the Vitest test suite. |
| `npm run db:migrate` | Apply committed database migrations. |
| `npm run db:dev` | Create and apply a migration when changing the schema locally. |
| `npm run db:generate` | Regenerate Prisma Client. |
| `npm run db:studio` | Open Prisma Studio. |

Database integration tests require `TEST_DATABASE_URL` pointing to a dedicated PostgreSQL test database with migrations applied. Do not use the production database for tests.

## Deploy to Vercel with Prisma Postgres

1. Push the repository to GitHub and import it into Vercel.
2. Connect a Prisma Postgres database to the Vercel project. Use separate databases for Production and Preview environments.
3. Configure `DATABASE_URL`, `SERPAPI_API_KEY`, and `APP_URL` in the relevant Vercel environments. Add `AI_PROVIDER=nvidia`, `NVIDIA_API_KEY`, and `AI_ENRICHMENT=true` if you want AI features.
4. Set `APP_URL` to the exact production origin, such as `https://ideaxray.aryanjathar.in`. The server also recognizes Vercel's deployment hostname for same-origin checks.
5. Deploy. The committed `vercel.json` runs `npm run db:migrate && npm run build`, applying migrations before building the app.
6. Check `/api/health`, then submit a real idea and verify its report and PDF.

Changes to Vercel environment variables require a new deployment to take effect. Keys and database credentials must remain server-only; do not prefix them with `NEXT_PUBLIC_` or commit `.env`.

### Background jobs

Analysis runs in a Next.js `after()` callback, with a 300-second function maximum and a default 240-second internal deadline. Deployment must support these durations. This is not a durable queue: a platform interruption, timeout, or deployment can interrupt a job. A durable worker is needed for reliable execution and retries at larger scale.

## Configuration reference

See `.env.example` for the full template.

| Variable | Purpose / default |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection string. |
| `SERPAPI_API_KEY` | Required SerpApi credential. |
| `APP_URL` | App origin; defaults to `http://localhost:3000`. |
| `AI_ENRICHMENT` | Optional AI planning and interpretation; defaults to `true`. |
| `AI_PROVIDER` | `nvidia` by default; also accepts `gemini` or `fallback`. |
| `NVIDIA_API_KEY` | NVIDIA credential for NVIDIA mode. |
| `NVIDIA_MODEL` | Comma-separated models tried in order; see `.env.example`. |
| `NVIDIA_TIMEOUT_MS` | NVIDIA request timeout; default `12000`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini settings when `AI_PROVIDER=gemini`. |
| `FREEAI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Legacy credentials used only in `fallback` mode. |
| `MAX_SEARCHES_PER_ANALYSIS` | Search-attempt budget; default `6`. |
| `MIN_SERPAPI_CREDITS` | Minimum remaining credits before research; default `6`. |
| `RELEVANCE_THRESHOLD` | Lexical evidence filter threshold; default `18`. |
| `ANALYSIS_TIMEOUT_MS` | Overall analysis deadline; default `240000`. |
| `RATE_LIMIT_PER_HOUR` | Per-browser-session creation/retry limit; default `10`. |
| `GLOBAL_ANALYSES_PER_HOUR` | Global creation/retry limit; default `20`. |
| `MAX_CONCURRENT_ANALYSES` | Simultaneous active analysis limit; default `2`. |

Provider access, available models, quotas, and response times depend on the configured account. Changing the provider requires its corresponding key and a server restart or redeployment.

## Troubleshooting

- **“This request did not come from the configured application.”** Set `APP_URL` to the exact origin you are visiting, including the local port or production HTTPS domain. Restart or redeploy after changing it.
- **Setup required / database error:** replace the placeholder `DATABASE_URL`, check connectivity, and run `npm run db:migrate` against the intended database.
- **Search unavailable:** check your SerpApi key, remaining credits, and the report's search trace.
- **No AI takeaways:** check the selected provider's key, model access, and timeout settings. Search evidence can still be explored when AI interpretation is unavailable.
- **Missing results:** inspect Sources and the search trace. Filters and search vocabulary can exclude relevant evidence; zero retained results do not prove that no related work exists.

## Data and research limitations

Reports belong to an anonymous browser session. Clearing its cookie or switching browsers can make saved reports inaccessible through the UI. Submitted ideas and search terms are sent to SerpApi and, when enabled, the configured AI provider. Analyses and evidence are persisted in PostgreSQL.

Counts describe retained, deduplicated evidence rather than total Google search hits. Product cards do not confirm competitor status, and coverage indicators are research heuristics. AI interpretations need human review. IdeaXray is research support, not a legal or patentability assessment. Commercial and crowding indicators can remain unavailable where the necessary classification is not performed.

Before broader public use, define data retention and deletion, monitor quotas and costs, and verify deployment capacity.

## AI tools disclosure

ChatGPT was used to assist with application code, design iteration, documentation, and a replacement hero image. Optional runtime AI is configured separately through the providers described above. Local Kokoro text-to-speech was used to add narration to the recorded demo video.
