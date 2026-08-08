#!/usr/bin/env bash
# Idempotent bootstrap for the NeuSpeak SvelteKit app in Cloud Agents.
# Safe to run repeatedly and against a warm/cached checkout.
set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Install JS dependencies (also runs `svelte-kit sync` via the prepare
#    script and builds the native better-sqlite3 addon).
npm ci

# 2. Local dev environment file. `.env` is gitignored, so create it if it does
#    not already exist. Placeholders keep `vite build` (which constructs the
#    OpenAI client during SvelteKit's analyse step) and the Supabase client
#    from throwing on empty values. Real credentials supplied as Cloud Agent
#    secrets are read from the process environment and take precedence, because
#    dotenv does not override variables already present in the environment.
if [ ! -f .env ]; then
  cat > .env <<'ENV'
OPENAI_API_KEY=sk-placeholder-local-dev
ORIGIN_URL=http://localhost:5173
MODEL_NAME=gpt-audio-1.5
TRANSCRIBE_MODEL=gpt-transcribe
COACH_VOICE=alloy
REALTIME_MODEL=gpt-realtime-2.1
REALTIME_VOICE=marin
JUDGE_MODEL=gpt-4o-mini
DATABASE_URL="file:./dev.db"
PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
PUBLIC_SITE_URL=http://localhost:5173
ENV
fi

# 3. Generate the Prisma client (output is gitignored) and create/upgrade the
#    local SQLite dev database. Both commands read DATABASE_URL from .env via
#    prisma.config.ts and are safe to re-run.
npx prisma generate
npx prisma migrate deploy

# 4. Playwright's Chromium is required by the vitest browser (client) test
#    project. Installing here bakes the browser into the environment snapshot.
npx playwright install chromium
