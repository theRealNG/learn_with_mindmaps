# Learn with Mindmaps

Turn a **Source** — a codebase, a document, or an open-ended topic — into a persistent **Map**
you can drill into. The AI generates the Map's Root Nodes from the Source; expanding a Node
generates its children, so you go from a high-level overview into as much detail as you want
instead of being handed a wall of text upfront.

Personal, local-only tool: no accounts, no hosting, no sharing. Your data stays in `./data`.

## Quick start

```bash
npm install
cp .env.example .env      # add your API key
npm run dev               # http://localhost:3000
```

## Configuration

All settings live in `.env` and are read server-side only — no key ever reaches the browser.

| Variable | Purpose |
| --- | --- |
| `LLM_PROVIDER` | `anthropic` (default) or `openai` |
| `LLM_MODEL` | Model id; defaults per provider |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Provider credentials |
| `OPENAI_BASE_URL` | Any OpenAI-compatible endpoint (Ollama, LM Studio, a gateway) |
| `MAX_TOOL_TURNS` | Hard cap on tool-call turns per generation (default 10) |
| `WEB_SEARCH_PROVIDER` | `duckduckgo` (default, keyless), `tavily`, `brave`, or `none` |
| `TAVILY_API_KEY` / `BRAVE_SEARCH_API_KEY` | Keys for those search backends |
| `DATA_DIR` | Where the SQLite file, documents, and repo clones live (default `./data`) |

The provider is behind a small abstraction, so swapping vendors is a config change rather than a
code change. Cost is shown in dollars when the active model's pricing is known, and as raw token
counts otherwise.

> The keyless DuckDuckGo backend scrapes an HTML endpoint and can be rate-limited or blocked.
> For Topic Maps you rely on, set `WEB_SEARCH_PROVIDER=tavily` or `brave` with a key.

## Sources

**Codebase** — a local path, or a git URL that's cloned into `data/repos` on first use. The clone
is keyed by normalized URL and reused across Maps and sessions. It is never re-pulled
automatically (Nodes shouldn't shift under you mid-exploration); use **Refresh repo** when you
want the latest commit.

**Document** — paste text, upload `.md` / `.txt` / `.pdf`, or give a URL to fetch. All three
normalize into one text file under `data/documents`, split into navigable sections.

**Topic** — a bare topic name, optionally with scoping notes and reference links. Grounded in web
search rather than recall alone, since there's no supplied text to check against.

## How generation works

Every generation — Root Nodes and each expansion alike — is one fresh tool-use turn. The model
gets exploration tools for the Source and decides what to look at:

| Source | Tools |
| --- | --- |
| Codebase | `list_directory`, `read_file`, `search_code` |
| Document | `list_sections`, `read_section`, `search_document` |
| Topic | `web_search`, `fetch_page` |

There is no embeddings index and no chunking pipeline; the model reads the live source each time.

Expansion is **Map-aware** but local: the model is given the ancestor chain from the Root Node
down to the Node being expanded, plus that Node's immediate siblings (label + summary each), so
children stay coherent with the branch without a whole-Map pass. Root Node generation is the
zero-th case of the same mechanism — no ancestors or siblings yet, seeded from the Source's
top-level structure.

The model finishes by calling `submit_nodes`. If it never does, the turn cap stops the generation
and returns what exists rather than looping; the UI says so. Submitting an empty list marks the
Node a **Leaf**.

## What's stored

SQLite (`data/mindmaps.db`), two tables:

- `maps` — title, source type and reference, plus running token/cost totals per Map
- `nodes` — `parent_id` (null marks a Root Node), label, summary, `expanded`, `has_children`, order

Only generated structure is persisted — never raw source excerpts, since every expansion explores
the Source fresh. Reopening a Map replays nothing; it reloads the tree and you resume from
wherever you left off.

## Browsing

Canvas on the left, detail panel on the right. The canvas renders the active path only — the Root
Nodes, then the children of each Node you've selected down the chain — so picking a different
branch clears the previous one rather than accumulating every branch you've ever opened. Navigate
up with the breadcrumb, down with the child chips in the detail panel. Pan and zoom are available
but aren't needed for the core loop.

## Project layout

```
app/            Next.js App Router pages and API routes
components/     Canvas, detail panel, map list, forms
lib/
  db.ts         SQLite schema and queries
  generate.ts   The capped agentic loop; root generation and expansion prompts
  llm/          Provider-agnostic message/tool protocol + Anthropic and OpenAI adapters
  sources/      Codebase, Document, and Topic exploration tools
  ingest.ts     Turning a path/URL/upload/topic into a Map
```

## Scripts

```bash
npm run dev        # local app
npm run build      # production build
npm run typecheck  # tsc --noEmit
```
