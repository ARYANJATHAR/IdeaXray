# IdeaXray

**See what happened to your idea.** IdeaXray is a research tool that helps you explore existing inventions, academic research, products, and market activity before developing an idea further.


https://github.com/user-attachments/assets/ff768811-d568-4d58-986c-9afbccdecb66



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

Next.js App Router, React, TypeScript, Tailwind CSS, Tabler Icons, Prisma with PostgreSQL, SerpApi, Zod, and client-side PDF generation with jsPDF and jsPDF-AutoTable. Azure OpenAI is the only optional AI provider.

## Run locally

### 1. Prerequisites

- Node.js **22 or newer** and npm.
- A PostgreSQL database. A separate Prisma Postgres development database also works.
- A [SerpApi API key](https://serpapi.com/).
- An Azure OpenAI endpoint, resource API key, and deployment name for optional AI features.

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

AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com/openai/v1/
AZURE_OPENAI_API_KEY=YOUR_AZURE_KEY
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini-1
AZURE_OPENAI_REASONING_EFFORT=low
AI_ENRICHMENT=true
```

Use your database provider's connection string, including its SSL options. For a local PostgreSQL instance, use the connection string appropriate to that instance.

**This code reads `DATABASE_URL`.** If your Vercel database integration provides `POSTGRES_URL`, copy its direct PostgreSQL connection-string value into `DATABASE_URL`. Setting only `POSTGRES_URL` or `PRISMA_DATABASE_URL` does not configure this app. A Prisma Accelerate URL requires additional integration and is not a replacement for the direct PostgreSQL URL in this setup.

To run searches without AI, leave `AZURE_OPENAI_API_KEY` empty and set `AI_ENRICHMENT=false`. SerpApi and the database are still required.

### Local Prisma Postgres connection settings

For the local `prisma dev` server, use a single client connection and pooler compatibility mode to avoid prepared-statement and portal collisions in its shared PostgreSQL session:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:51214/template1?sslmode=disable&connection_limit=1&statement_cache_size=0&pgbouncer=true
```

Restart Next.js after changing this URL so its cached Prisma client reconnects. These settings are for this local database. Use your hosted database provider's connection settings for production. Start an existing local database with `npx prisma dev start ideaxray`.

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

### Use Azure OpenAI for AI features

The application targets the **GPT-5 mini** deployment `gpt-5-mini-1` for search planning and source-backed summaries. This integration uses JSON mode with the existing Zod response validation. Model availability and quota depend on your Azure resource and region.

Copy `.env.example` to `.env` if you have not already, then set:

```dotenv
AI_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
AZURE_OPENAI_API_KEY=YOUR_AZURE_RESOURCE_KEY
AZURE_OPENAI_DEPLOYMENT=gpt-5-mini-1
AZURE_OPENAI_REASONING_EFFORT=low
AI_ENRICHMENT=true
```

`AZURE_OPENAI_DEPLOYMENT` must match the deployment name you created in Azure, rather than necessarily matching the model ID. The endpoint also accepts the full `/openai/v1/` base URL, including the `services.ai.azure.com` resource format. If Azure gives a URL ending in `/responses`, remove `responses` to get the base URL. Project URLs and older `/openai/deployments/...` URLs are not supported here. Set reasoning effort to `low` for GPT-5 mini; leave it blank for models without reasoning support. Azure requests cap total completion tokens (including reasoning) at 8192.

Azure mode sends AI requests exclusively to your configured Azure endpoint, using the resource key in the `api-key` header. It uses the v1 Chat Completions API, so no `api-version` setting or additional SDK is needed. Existing timeout settings apply. Keep `SERPAPI_API_KEY` and `DATABASE_URL` configured: Azure provides the AI layer, while SerpApi supplies research results. Restart the server or redeploy after changing settings. `/api/health` still does not verify AI credentials or model access.

References: [Azure v1 API](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle), [supported structured-output models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs).

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
3. Configure `DATABASE_URL`, `SERPAPI_API_KEY`, and `APP_URL` in the relevant Vercel environments. Add the Azure endpoint, resource key, deployment name, and `AI_ENRICHMENT=true` if you want AI features.
4. Set `APP_URL` to the exact production origin, such as `https://ideaxray.aryanjathar.in`. The server also recognizes Vercel's deployment hostname for same-origin checks.
5. Deploy. The committed `vercel.json` runs `npm run db:migrate && npm run build`, applying migrations before building the app.
6. Check `/api/health`, then submit a real idea and verify its report and PDF.

Changes to Vercel environment variables require a new deployment to take effect. Keys and database credentials must remain server-only; do not prefix them with `NEXT_PUBLIC_` or commit `.env`.

### Production environment for the Azure deployment

Set these in Vercel's **Production** environment before redeploying:

| Variable | Production value |
| --- | --- |
| `AI_PROVIDER` | `azure` (replace any previous provider value) |
| `AZURE_OPENAI_ENDPOINT` | `https://aryanjathar0723-9904-resource.services.ai.azure.com/openai/v1/` |
| `AZURE_OPENAI_API_KEY` | Resource key, entered as a secret in Vercel |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-5-mini-1` |
| `AZURE_OPENAI_REASONING_EFFORT` | `low` |
| `AI_ENRICHMENT` | `true` |
| `DATABASE_URL` | Hosted PostgreSQL connection string with the provider's SSL and pool settings |
| `SERPAPI_API_KEY` | Search key, entered as a secret in Vercel |
| `APP_URL` | `https://ideaxray.aryanjathar.in` (or the exact deployed origin) |

Keep the existing hosted production database and its data if already configured. Never copy the local `localhost:51214` URL or its development compatibility flags into production. The build runs migrations, so the configured database must support direct PostgreSQL connections and schema migrations. Preview builds must use a separate database.

Remove obsolete AI provider keys and model settings from Vercel. Select Node.js 22 and ensure Fluid compute and the configured 300-second function duration are supported. Before pushing, run `npm test`, `npm run lint`, and `npm run build`. After deployment, check `/api/health`, then run one real investigation and inspect its search trace, findings, and PDF. A health response alone does not validate Azure or SerpApi credentials.

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
| `AI_PROVIDER` | `azure` is the only supported value and the default. |
| `AZURE_OPENAI_ENDPOINT` | Azure resource HTTPS origin or `/openai/v1/` base URL. |
| `AZURE_OPENAI_API_KEY` | Server-only Azure OpenAI resource key. |
| `AZURE_OPENAI_DEPLOYMENT` | Exact Azure deployment name; required in Azure mode. |
| `AZURE_OPENAI_REASONING_EFFORT` | Optional `minimal`, `low`, `medium`, or `high`; use `low` for GPT-5 mini. |
| `MAX_SEARCHES_PER_ANALYSIS` | Search-attempt budget; default `6`. |
| `MIN_SERPAPI_CREDITS` | Minimum remaining credits before research; default `6`. |
| `RELEVANCE_THRESHOLD` | Lexical evidence filter threshold; default `18`. |
| `ANALYSIS_TIMEOUT_MS` | Overall analysis deadline; default `240000`. |
| `RATE_LIMIT_PER_HOUR` | Per-browser-session creation/retry limit; default `10`. |
| `GLOBAL_ANALYSES_PER_HOUR` | Global creation/retry limit; default `20`. |
| `MAX_CONCURRENT_ANALYSES` | Simultaneous active analysis limit; default `2`. |

Provider access, available models, quotas, and response times depend on the configured account. Changing Azure credentials or the deployment requires a server restart or redeployment.

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
