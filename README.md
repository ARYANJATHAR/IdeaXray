# IdeaXray

**See what happened to your idea before you build it.**

IdeaXray investigates the patents, research, products, companies, news, and trends surrounding a proposed idea. This hackathon edition runs as a single Next.js app with SQLite — no Docker, Redis, worker process, or embedding API required.

## Quick start

```powershell
cd ideaxray
Copy-Item .env.example .env
npm install
npm run db:migrate
npm run dev
```

Open http://localhost:3000

### Configure live research

Fill in `.env`:

| Variable | Purpose |
| --- | --- |
| `SERPAPI_API_KEY` | SerpApi credential (server-only) |
| `GROQ_API_KEY` | Primary AI provider (Groq free tier) |
| `OPENROUTER_API_KEY` | Backup AI provider (OpenRouter free router) |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-120b` |
| `OPENROUTER_MODEL` | Defaults to `openrouter/free` |
| `DATABASE_URL` | Defaults to `file:./dev.db` |

IdeaXray tries **Groq first**, then falls back to **OpenRouter** if Groq fails, rate-limits, or returns invalid JSON.

Visit `/api/health` to confirm configuration and database readiness.

## What changed in this edition

- **One process:** analysis runs in the background inside the Next.js server — no separate worker
- **SQLite:** no PostgreSQL or Docker
- **No Redis / BullMQ**
- **Lexical relevance ranking:** no embedding API
- **Six searches per report:** patents, scholar, web, news, trends
- **Simpler report:** summary, solutions, patents, research, history, gaps, search trace, sources
- **Dual LLM fallback:** Groq + OpenRouter

## Architecture

```text
Landing (/) → Analyze (/analyze) → POST /api/analyses
  → inline background pipeline
  → SerpApi
  → LLM (Groq → OpenRouter fallback)
  → SQLite
  → SSE progress + report UI
```

## SerpApi engines used

| Engine | Role |
| --- | --- |
| `google_patents` | Related inventions |
| `google_scholar` | Academic research |
| `google` | Products and companies |
| `google_news` | Market activity |
| `google_trends` | Public interest momentum |

## Demo script

1. Enter: “A backpack that automatically follows its owner using computer vision.”
2. Start research on `/analyze`.
3. Show live progress stages.
4. Inspect patents, research, products, opportunity gaps.
5. Open Search Trace to show SerpApi queries and retained counts.

## Limitations

IdeaXray is a bounded investigation, not a legal opinion or exhaustive patent search. Landscape indicators are research heuristics backed by live SerpApi and LLM calls.

Hackathon track: **Knowledge & Public Interest**.
