# Hosted-only on Supabase, with generation as durable background jobs

The product moved from a personal, local-only tool (SQLite and files in `./data`, keys in `.env`) to a hosted multi-user service with operator-paid LLM calls. We chose Supabase (Postgres, Auth, object storage) behind the existing Next.js app, and run every generation as a background job on a durable workflow service (Inngest / Trigger.dev class) rather than inside the request — whole-Document generation is long and multi-step, outlives serverless request timeouts and Supabase Edge Function limits, and benefits from per-step retries and progress reporting. The local SQLite mode is dropped rather than kept behind a switch, so there is one storage, auth and job backend to build and test.

## Considered Options

- **Own Postgres + S3 + separate auth provider** — more control, more infrastructure to run for no v1 benefit.
- **Single server with the current stack on a persistent disk** — simplest port, but doesn't scale past one box and keeps confidential Documents on local disk.
- **Supabase queue + self-run worker (Fly/Railway)** — the fallback if the workflow service's cost or lock-in bites.
- **Keeping local mode alongside hosted** — doubles every backend for a mode with no users besides the author.

## Consequences

- Documents are now retained for a Map's lifetime (provenance needs them), which reverses the local app's "never persist source excerpts" rule; they're encrypted at rest and hard-deleted with their Map or User.
- Codebase and Topic Sources are disabled in hosted v1 (cloning arbitrary repos and paid web search need their own decisions).
