# NeuSpeak — API & Audio/Realtime Architecture

Internal developer note. Read this before touching `src/routes/api/*` or `src/lib/server/*`.

## Overview

NeuSpeak is a browser-based English speaking coach. The default experience is
a **live, hands-free voice conversation**: the learner presses "Start
conversation" once, grants mic access, and then just talks — no record
button. Under the hood the browser opens a WebRTC connection straight to
OpenAI's Realtime API, so the tutor listens continuously, detects turns on
its own, and speaks its replies back through the same connection.

The original request/response HTTP flow (record a clip → transcribe →
generate a text/audio reply → play it back) still exists as `/api/asr` and
`/api/ai`. Those routes are no longer wired into the default UI, but they're
kept as a simpler fallback pattern and as a reference for anything that needs
a bounded, one-shot request instead of a live session.

A separate, lighter-weight feature — **Voice Battle** (`/practice`) — reuses
that same request/response shape (record one clip → transcribe → grade it)
but is a self-contained mini-game: every visitor gets an anonymous account,
records short utterances for points, and appears on a shared leaderboard.
See "Voice Battle & persistence" below.

High-level data flow:

```
Browser UI  →  SvelteKit server routes         →  OpenAI APIs
 (Svelte)      /api/health                        (none)
               /api/realtime/session (GET)        POST /v1/realtime/client_secrets
               ── ephemeral token ──►  Browser  ──WebRTC──►  /v1/realtime/calls
               /api/asr   (legacy, unused by UI)  POST /v1/audio/transcriptions
               /api/ai    (legacy, unused by UI)  POST /v1/chat/completions (audio-capable model)
```

The browser only ever calls our own `/api/...` routes for anything that
needs `OPENAI_API_KEY` — the one exception is the live voice session itself,
where the browser's `RTCPeerConnection` talks directly to
`api.openai.com/v1/realtime/calls` using a short-lived **ephemeral token**
(never the real API key) that our server minted on its behalf. See
"Current v2 architecture (Realtime/WebRTC)" below.

## Current v2 architecture (Realtime/WebRTC) — the default experience

This is what actually plays when you click "Start conversation" today.

### Flow

1. `StartButton.svelte` requests mic permission and pings `GET /api/health`
   as a basic connectivity check.
2. On success, `+page.svelte` calls `RealtimeVoice.svelte`'s `connect()`.
3. `connect()` fetches `GET /api/realtime/session`, which mints an ephemeral
   client secret server-side (see below) and returns it to the browser.
4. The browser builds an `RTCPeerConnection`: adds the mic as a local audio
   track, creates a data channel (`oai-events`) for JSON control events, and
   sets `pc.ontrack` to route the model's remote audio stream into a
   `<audio autoplay>` element — no manual playback or base64 decoding needed,
   WebRTC streams it live.
5. The browser does an SDP offer/answer exchange directly with
   `https://api.openai.com/v1/realtime/calls`, authenticated with the
   ephemeral token (`Authorization: Bearer ek_...`), not the real API key.
6. Once the data channel opens, the session is live: OpenAI's server-side VAD
   (`semantic_vad`) detects when the learner starts/stops talking and
   triggers replies automatically — no client-side "record" step at all.

### `GET /api/realtime/session`

Mints a short-lived ephemeral client secret via
`POST https://api.openai.com/v1/realtime/client_secrets`, authenticated with
the real `OPENAI_API_KEY` server-side, and returns only the ephemeral value
to the browser:

```json
{ "value": "ek_...", "expiresAt": 1699999999 }
```

The session config sent when minting the token (not sent by the browser)
defines the coach's behavior for that whole conversation:

- `model`: `REALTIME_MODEL` (defaults to `gpt-realtime-2.1`).
- `instructions`: `COACH_SYSTEM_PROMPT` (same persona text used by `/api/ai`).
- `audio.output.voice`: `REALTIME_VOICE` (defaults to `marin`).
- `audio.input.transcription.model`: `gpt-4o-mini-transcribe`, so we get
  `conversation.item.input_audio_transcription.completed` events with what
  the learner said (used to populate their side of the chat log).
- `audio.input.turn_detection.type`: `semantic_vad`, so turns end based on
  meaning/pause rather than a fixed silence timeout.

### `RealtimeVoice.svelte`

Owns the `RTCPeerConnection`, the data channel, and the mic `MediaStream`.
Exposes `connect()`, `disconnect()`, `setMuted()`, and `sendText()` to the
parent page, and reports back via callback props (`onstatus`, `onlog`,
`onerror`, `onusertranscript`, `onassistantdelta`, `onassistantdone`) instead
of owning the chat log itself. Key server events it listens for on the data
channel:

| Event                                                   | Meaning                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| `conversation.item.input_audio_transcription.completed` | What the learner said (finalized)                 |
| `response.output_audio_transcript.delta` / `.done`      | The tutor's spoken reply, streamed then finalized |
| `input_audio_buffer.speech_started` / `.stopped`        | Turn-taking, logged to the debug panel            |
| `error`                                                 | Surfaced via `onerror` and logged                 |

Typed messages (the "type a practice line" input in `+page.svelte`) are sent
into the **same live session** via `sendText()`, which emits a
`conversation.item.create` (role `user`, `input_text`) followed by a
`response.create` client event — so typed and spoken turns share one
conversation and both get a spoken reply through the same audio stream.

> **Note on event names:** Realtime's GA interface event names
> (`response.output_audio_transcript.delta`, etc.) are newer than some older
> docs/blog posts (`response.audio_transcript.delta`). `RealtimeVoice.svelte`
> listens for both old and new names defensively. If OpenAI renames these
> again, check the debug panel — unhandled event types aren't currently
> logged verbosely, so add a temporary `console.log(event)` in
> `handleServerEvent` if replies stop showing up in the chat log.

### Connection state machine (`src/lib/session.ts`)

The header badge, the Start/Restart button, `RealtimeVoice.svelte`, and the
debug panel all read/write **one** shared vocabulary instead of each
component inventing its own idea of "connected." That vocabulary lives in
`src/lib/session.ts` as the `SessionState` type:

```
idle → mic → connecting → connected ⇄ sending → disconnecting → disconnected
                              ↑                                       │
                              └───────────── Start/Restart ───────────┘
any state → error (on failure)
```

| State           | Meaning                                                                                                            | Set by                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `idle`          | Before any attempt                                                                                                 | initial value                                     |
| `mic`           | Requesting microphone permission                                                                                   | `StartButton.svelte`                              |
| `connecting`    | Health check, then Realtime token + WebRTC handshake                                                               | `StartButton.svelte`, then `RealtimeVoice.svelte` |
| `connected`     | Live session, coach is listening                                                                                   | `RealtimeVoice.svelte`                            |
| `sending`       | A turn is in flight (user just finished speaking, a typed message was sent, or the assistant's reply is streaming) | `RealtimeVoice.svelte`                            |
| `disconnecting` | "End conversation" was clicked, cleanup running                                                                    | `RealtimeVoice.svelte`                            |
| `disconnected`  | Session fully closed — no more calls will fire until Start is clicked again                                        | `RealtimeVoice.svelte`                            |
| `error`         | The start attempt or an in-session event failed                                                                    | `StartButton.svelte` or `RealtimeVoice.svelte`    |

`+page.svelte` holds the single source of truth (`sessionState`) and just
relays it down; it never derives a second, competing state variable. Helper
predicates (`isSessionActive`, `isSessionAtRest`, `isSessionBusy` in
`src/lib/session.ts`) centralize the "can I send/can I click Start" checks
so button-disabled logic can't drift out of sync with the state list.

### Cleanup on "End conversation"

Clicking **End conversation** (rendered inside `RealtimeVoice.svelte` while
`connected`/`sending`) calls `disconnect()`, which:

1. Sets state to `disconnecting` and logs "Cleanup started" to the debug
   panel.
2. Runs `teardown()`, which — each step isolated in its own `try/catch` so
   one failure can't block the rest — removes the data channel's `message`
   listener and closes it, stops every microphone `MediaStreamTrack`, closes
   the `RTCPeerConnection` (there's no separate "close session" REST call for
   Realtime over WebRTC; closing the peer connection **is** what ends the
   call server-side), and detaches the remote `<audio>` element.
3. Sets state to `disconnected` and logs a final confirmation line.

Every one of those steps is logged individually to the debug panel, so "what
did cleanup actually close?" is always answerable without opening devtools.

`handleServerEvent` also ignores (and logs) any data-channel message that
somehow still arrives while `disconnecting`/`disconnected` — belt-and-braces
against a message event that was already queued in the browser's event loop
before `close()` took effect.

### Detecting stray API calls (`src/lib/apiInstrumentation.ts`)

`reportApiCall(route, state)` is a small, non-blocking helper every client
call to `/api/asr` or `/api/ai` should go through (currently used by the
debug panel's "Test /api/asr" / "Test /api/ai" buttons — wrap any future
call site with it too). It:

- Always logs the call and the session state it fired in
  (`console.debug` in dev).
- If `state` isn't `connected` or `sending` — i.e. `idle` or `disconnected`
  — logs a `console.warn` and returns `isStray: true`, which the debug panel
  surfaces as a dismissible amber banner. This is what makes a stale
  listener/timer/recorder callback firing after "End conversation" loud
  instead of silent.

It deliberately **warns rather than throws**, so it can wrap manual test
tooling (which should always be able to fire on demand) as well as any real
call sites without breaking either.

## Legacy v1 architecture (HTTP, kept but unused by the UI)

Each route is a SvelteKit `+server.ts` endpoint under `src/routes/api/`.

### `GET /api/health`

Connectivity check used by the "Start conversation" flow (mic permission →
health check → Ready). Returns:

```json
{ "ok": true, "ts": 1699999999999 }
```

### `POST /api/asr`

Accepts a raw `audio/webm` binary body (what the browser's `MediaRecorder`
produces). Validates content-type and size, then calls OpenAI transcription
and returns:

```json
{ "transcript": "...", "durationMs": 812, "confidence": 1 }
```

- Model: `gpt-transcribe` (via `TRANSCRIBE_MODEL`), OpenAI's current
  recommended transcription model. It accepts `webm` directly — no
  client-side re-encoding needed.
- Size cap: 10MB (OpenAI's own limit on this endpoint is 25MB; we're more
  conservative).
- `confidence` is currently hardcoded to `1` — `gpt-transcribe`'s default
  JSON response doesn't include a confidence score. Revisit this if we adopt
  a model/`response_format` that reports one (see the TODO comments in the
  route file).
- An empty/undetected transcript returns `422`, not a silent success —
  callers should treat that as "ask the user to record again," not a crash.

### `POST /api/ai`

Accepts `{ "message": string }`, validated with a Zod schema
(`src/lib/schemas.ts`), calls an OpenAI chat model, and returns:

```json
{ "reply": "...", "audio": { "data": "<base64 wav>", "format": "wav" } }
```

- Uses **Chat Completions** (`openai.chat.completions.create`) with
  `modalities: ["text", "audio"]`, **not** the Responses API. As of the
  current audio docs, the Responses API only supports text/image input with
  text output — spoken replies require the Chat Completions audio-chat
  pattern with an audio-capable model
  (see https://developers.openai.com/api/docs/guides/audio). If a future
  Responses API update adds audio output support, we can migrate back and
  simplify this route.
- Model: `MODEL_NAME` (defaults to `gpt-audio-1.5` if unset) — **must** be an
  audio-capable Chat Completions model, not a plain text model and not a
  Realtime-only model.
- Voice: `COACH_VOICE` (defaults to `alloy`) — passed as `audio.voice` in the
  request.
- The system prompt (`COACH_SYSTEM_PROMPT` in `src/lib/server/openai.ts`)
  defines the coach persona: short, encouraging, conversational replies that
  gently model correct English instead of lecturing on grammar.
- Reply text comes from `choices[0].message.audio.transcript` (the spoken
  transcript), falling back to `message.content` if audio wasn't returned.
  Raw audio bytes come back base64-encoded in `choices[0].message.audio.data`
  and are passed straight through to the browser as `audio.data`.
- Payload size cap on the **request** is 10KB (this is a short text message,
  not audio) — the response is bigger because it carries base64 audio, and
  that's expected.
- The browser attempts to autoplay `audio` as soon as a reply arrives; if the
  browser blocks autoplay, the chat bubble also gets a manual replay button
  (`ChatLog.svelte`) so the reply is never unreachable.

### Where secrets live

- `OPENAI_API_KEY` and all model name env vars are read **only** inside
  `src/lib/server/openai.ts` and `+server.ts` route files, via
  `$env/dynamic/private`.
- `src/lib/server/` is a SvelteKit-enforced boundary: any attempt to import
  something from `src/lib/server/*` into client-reachable code (a `.svelte`
  file, or a module a `.svelte` file imports) fails the build. Don't move the
  OpenAI client out of that folder.
- **No environment variables are read in `.svelte` files or any other
  client-bundled code.** If you ever find yourself typing `env.` or
  `process.env.` inside a `.svelte` file, stop — that's the wrong layer.

### Env vars (current)

| Var                        | Purpose                                                                                                                                                           | Example                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `OPENAI_API_KEY`           | Server-side OpenAI auth. Never sent to the browser.                                                                                                               | `sk-proj-...`                 |
| `MODEL_NAME`               | Audio-capable Chat Completions model for `/api/ai`.                                                                                                               | `gpt-audio-1.5`               |
| `COACH_VOICE`              | Voice preset for the coach's spoken reply in `/api/ai`.                                                                                                           | `alloy`                       |
| `TRANSCRIBE_MODEL`         | Transcription model for `/api/asr`.                                                                                                                               | `gpt-transcribe`              |
| `REALTIME_MODEL`           | Model for the live Realtime/WebRTC session (`/api/realtime/session`).                                                                                             | `gpt-realtime-2.1`            |
| `REALTIME_VOICE`           | Voice preset for the tutor's live spoken replies. Options: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`.               | `marin`                       |
| `JUDGE_MODEL`              | Text model that grades Voice Battle recordings (`/api/battle`).                                                                                                   | `gpt-4o-mini`                 |
| `DATABASE_URL`             | Prisma datasource URL for Voice Battle persistence.                                                                                                               | `file:./dev.db`               |
| `ORIGIN_URL`               | Local/prod origin, reserved for CORS/redirect config as the app grows.                                                                                            | `http://localhost:5173`       |
| `PUBLIC_SUPABASE_URL`      | Supabase project URL. `PUBLIC_` prefix means SvelteKit allows it in client bundles too, but we currently only read it server-side (`src/lib/server/supabase.ts`). | `https://xxxx.supabase.co`    |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key — safe to expose by design; access is scoped per-table by Row Level Security policies, not by keeping this secret.                       | `eyJ...`                      |
| `PUBLIC_SITE_URL`          | Optional. Base URL for Supabase Auth email redirect links (see "Authentication" below). Falls back to `window.location.origin` if unset.                          | `https://neuspeak.vercel.app` |

`.env` holds real values and is gitignored. `.env.example` mirrors the same
keys with empty/placeholder values and **is** committed — never put a real
key in `.env.example`.

> **Known gotcha:** `MODEL_NAME` must be an audio-capable Chat Completions
> model (e.g. `gpt-audio-1.5`), not a plain text model like `gpt-4o` and not
> a Realtime-only model like `gpt-4o-realtime-preview`. A plain text model
> will reject `modalities: ["text", "audio"]`, and a Realtime-only model
> isn't valid for `/v1/chat/completions` at all. Both fail with a 502 from
> `/api/ai` (check the server terminal for the underlying OpenAI error).

## Supabase migration (personalization, in progress)

NeuSpeak is moving from SQLite (which doesn't work reliably on Vercel's
serverless filesystem) to a hosted **Supabase Postgres** database, so
conversations, scores, and usage can persist per-user across devices and
sessions instead of living only in the browser or a local file.

### Connectivity test (`/api/test-db`, `/test-db`)

Before wiring any real tables (`Account`, `Conversation`, etc.) to Supabase,
`supabase/sql/000_test_events.sql` creates a throwaway `test_events` table
(`id uuid`, `message text`, `created_at timestamptz`), and:

- `GET /api/test-db` (`src/routes/api/test-db/+server.ts`) inserts one row
  (`{ message: 'hello from NeuSpeak' }`) via `src/lib/server/supabase.ts`
  and reads the 5 most recent rows back.
- `/test-db` (`src/routes/test-db/+page.svelte`) is a minimal page that
  calls it on load (and has a button to re-run) and lists the rows.

**Setup:** paste `supabase/sql/000_test_events.sql` into the Supabase
dashboard's SQL Editor and run it once, then visit `/test-db`.

**This is throwaway.** Once connectivity is proven, delete the SQL file,
`/api/test-db`, and `/test-db` — don't reuse its permissive
"anon can do anything" RLS policy for tables that hold real user data.

### Supabase client (`src/lib/server/supabase.ts`)

Uses `@supabase/supabase-js` with the **anon key**, same pattern as the
OpenAI client: instantiated once in `src/lib/server/`, read via
`$env/dynamic/public`. The anon key is safe to expose (Supabase's model
relies on Row Level Security per table, not on keeping this key secret), but
for now every Supabase call still goes through our own server routes, same
as OpenAI — no direct browser-to-Supabase calls yet. That may change once
real auth is wired up and `@supabase/ssr` manages a per-user session/token
in the browser.

### Planned next steps

1. Point Prisma's `DATABASE_URL` at Supabase's pooled Postgres connection
   string instead of `file:./dev.db`, swap the driver adapter (`@prisma/adapter-better-sqlite3`
   → `@prisma/adapter-pg`), and re-run migrations — this fixes `/api/battle`
   and `/api/me`, which are currently broken in production (see the "Known
   gotcha" below).
2. ~~Add Supabase Auth~~ — done, see "Authentication (Supabase Auth)" below.
   `src/hooks.server.ts`'s anonymous cookie ID is unchanged for now (still
   powers Voice Battle) and runs alongside real auth, not replaced by it yet.
3. ~~Add `Conversation`/`Message` tables and persist the live Realtime
   chat~~ — done, see "Conversation history persistence" below.
4. Add a `Preferences` table (CEFR level, tutor style, goals) and use it to
   personalize the Realtime session's `instructions`.

> **Known gotcha (as of this doc's last update):** `src/hooks.server.ts`
> currently hands out a bare `crypto.randomUUID()` that's never written to
> the database (a stopgap after SQLite broke on Vercel). `getAccountStats()`
> in `src/lib/server/leaderboard.ts` calls `prisma.account.findUniqueOrThrow()`
> with that ID, which throws — so `/api/battle` and `/api/me` fail in
> production until step 1 above is done and real `Account` rows exist again.
> This is separate from Supabase Auth below — `/practice` isn't guarded by
> login (yet), so it still uses the anonymous cookie exclusively.

## Authentication (Supabase Auth)

NeuSpeak used to be an open demo: anyone hitting `/` could start talking to
the coach immediately. Now the main chatbot page requires a real, logged-in
account — the prerequisite for saving conversations, tracking usage, and
showing personalized progress per user (see "Planned next steps" above).

### Two Supabase clients, two purposes

- **`src/lib/server/supabase.ts`** (pre-existing) — server-only, anon key,
  used for plain data queries (currently just the `/api/test-db` throwaway).
  Never touches auth/session state.
- **`src/lib/auth/supabaseClient.ts`** (new) — browser client built with
  `@supabase/ssr`'s `createBrowserClient`. Used only from `.svelte` files for
  the actual auth calls (`signInWithPassword`, `signUp`,
  `resetPasswordForEmail`, `updateUser`, `signOut`). Unlike a plain
  `@supabase/supabase-js` browser client, this one writes the session into
  **cookies**, not just `localStorage` — that's what lets our server-side
  routes see the same logged-in session.

### Server-side session plumbing

- **`src/hooks.server.ts`** now runs two independent `Handle`s via
  `sequence()`: `supabaseAuthHandle` (new) creates a request-scoped
  `event.locals.supabase` (via `@supabase/ssr`'s `createServerClient`, reading
  cookies with `event.cookies.getAll()`/`.set()`) and
  `event.locals.safeGetSession`; `anonymousAccountHandle` (pre-existing,
  unchanged) still sets `event.locals.accountId` for Voice Battle.
- **`src/lib/auth/session.ts`** exports `createSafeGetSession(supabase)`,
  which re-validates the session's JWT via `supabase.auth.getUser()` rather
  than trusting `getSession()`'s cookie value alone (a forged/stale cookie
  shouldn't look like a valid login) — this is what `event.locals.safeGetSession`
  actually calls.
- **`src/routes/+layout.server.ts`** calls `locals.safeGetSession()` on every
  request and returns `{ session, user }` as page data — purely informational,
  it never redirects. `depends('supabase:auth')` lets the client force a
  refresh after login/logout without a full page reload.

### Route guarding

- **`src/routes/+page.server.ts`** guards the root chatbot page only: no
  `user` ⇒ `redirect(303, '/login?redirectTo=/')`. Other routes
  (`/practice`, `/api/*`, `/test-db`) are intentionally **not** guarded yet —
  scope was "the main chatbot page" for this pass.
- **`src/routes/login/+page.server.ts`** and **`signup/+page.server.ts`**
  do the inverse: an already-logged-in user visiting either is redirected
  straight to `/` (or `?redirectTo`) instead of seeing the form again.
- **`src/routes/update-password/+page.server.ts`** requires an active
  (recovery) session; without one it redirects to `/reset-password?expired=1`
  instead of showing a dead form.

### Auth pages (`src/routes/login`, `/signup`, `/reset-password`, `/update-password`)

All four call `src/lib/auth/supabaseClient.ts` directly from the browser
(no `+server.ts` needed — Supabase Auth's REST API is what `anon` key + RLS
is designed for). Shared UI: `src/lib/components/PasswordField.svelte` gives
every password input a keyboard-accessible show/hide toggle (`aria-label`,
`aria-pressed`); signup and update-password additionally show **live**
match/length feedback (`$derived` state, not just on submit), always paired
with text (never color alone).

- `/login` — `signInWithPassword`, then `invalidate('supabase:auth')` +
  `goto(redirectTo)` on success so the guard on `/` sees the fresh cookie.
- `/signup` — `signUp({ email, password, options: { emailRedirectTo } })`.
  If Supabase has email confirmation **on** (the default), there's no session
  yet — shows a "check your email" message. If it's off, `data.session` comes
  back immediately and we skip straight to `/`.
- `/reset-password` — `resetPasswordForEmail(email, { redirectTo })`. Always
  shows the same "check your email" message whether or not the address is
  registered (Supabase's own anti-enumeration behavior — don't add a "no
  account found" branch here).
- `/update-password` — `updateUser({ password })` using the session that
  `/auth/callback` already established from the recovery link.

### `/auth/callback` — the PKCE bridge

Supabase's email links use the PKCE flow: they redirect to a URL with a
`?code=` param, not the session tokens directly. `src/routes/auth/callback/+server.ts`
exchanges that code (`locals.supabase.auth.exchangeCodeForSession(code)`),
which writes the resulting session into cookies, then redirects to `?next=`
(defaulting to `/`) — `/signup` points `next` at `/`, `/reset-password`
points it at `/update-password`. A missing/rejected code (link already used,
expired, or tampered) redirects to `/reset-password?expired=1` or
`/login?error=auth_callback` instead of silently failing.

**This exact path must be a Supabase Redirect URL for every environment**:
`{origin}/auth/callback` — see "Supabase dashboard configuration" below.

### Nav / logged-in state (`src/routes/+layout.svelte`)

Reads `data.session`/`data.user` (from `+layout.server.ts`) to show
Log in/Sign up vs. the user's email + Log out. Also subscribes to
`supabase.auth.onAuthStateChange` so a login/logout from anywhere in the app
re-runs the layout's server load (`invalidate('supabase:auth')`) instead of
leaving the nav stale until the next navigation.

### Supabase dashboard configuration (do this manually — not code)

1. **Authentication → Providers → Email**: confirm it's enabled (it is by
   default). Leave "Confirm email" on unless you have a reason to skip
   email verification. Social providers (Google, etc.) are out of scope for
   now.
2. **Authentication → URL Configuration → Site URL**: your primary origin
   (use the production URL once deployed, e.g. `https://neuspeak.vercel.app`
   — Supabase uses this as the default base for some generated links).
3. **Authentication → URL Configuration → Redirect URLs**: add **both**,
   one per environment:
   - `http://localhost:5173/**` (match your actual local dev port)
   - `https://<your-vercel-domain>/**`

   Without both, email links will redirect to whichever origin _isn't_ in
   this list, landing on a broken/unreachable URL — the single most common
   cause of "confirmation link goes to localhost in production" (or the
   reverse). The `/**` wildcard covers `/auth/callback`, `/update-password`,
   etc. without listing each path.

4. If you set `PUBLIC_SITE_URL`, keep it in sync with the Site URL above —
   mirror it in Vercel's project Environment Variables too, not just local
   `.env`. That said, every redirect call in this app (`getSiteUrl()` in
   `src/lib/auth/redirects.ts`) falls back to `window.location.origin` when
   `PUBLIC_SITE_URL` is unset, so a stale/missing value can't silently break
   auth on whichever origin the user is actually on — it's a convenience,
   not a hard dependency.

### Known limitations (intentional, for this pass)

- Only `/` and `/history` are guarded. `/practice` and all `/api/*` routes
  still use the anonymous cookie and are reachable while logged out.
- No password-strength meter beyond a flat 8-character minimum
  (`MIN_PASSWORD_LENGTH` in `signup/+page.svelte` and `update-password/+page.svelte`).
- No rate limiting on `/login`, `/signup`, or `/reset-password` beyond
  whatever Supabase itself enforces.

## Conversation history persistence

Before this, every conversation lived only in `+page.svelte`'s `messages`
`$state` array — a refresh, tab close, or crash lost it permanently, and
there was nowhere to show a learner their own progress over time. This adds
the first (and intentionally only) piece of that: **sessions** (one row per
"Start conversation" press) and **messages** (one row per completed turn),
scoped to whichever Supabase Auth user is logged in. Prompt-preset and
usage-tracking tables are deliberately _not_ part of this pass.

### Schema (`database/create_conversation_tables.sql`)

Two tables, `public.conversations` and `public.messages`, linked to
Supabase Auth's own `auth.users` — there's no separate `public.users`
table, since duplicating identity Supabase Auth already owns would just be
another thing to keep in sync.

| Table           | Key columns                                                                                                | Notes                                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversations` | `id`, `user_id → auth.users(id)`, `title`, `created_at`, `updated_at`                                      | One row per session. `title` defaults to a timestamp label at creation (`src/lib/server/conversations.ts`); `updated_at` is bumped on every message insert so history can sort by "most recently active". |
| `messages`      | `id`, `conversation_id → conversations(id)`, `role` (`user`/`assistant`/`system`), `content`, `created_at` | Append-only — no update/delete policy exists for this table, on purpose.                                                                                                                                  |

**Row Level Security** is enabled on both tables. `conversations` policies
check `auth.uid() = user_id` directly; `messages` has no `user_id` of its
own, so its policies check ownership via a subquery against its parent
conversation. This means a leaked/forged conversation id is still useless
to another user — Postgres itself rejects the read/write, not just our API
route's logic.

**Setup:** paste `database/create_conversation_tables.sql` into the
Supabase dashboard's SQL Editor and run it once (same flow as
`supabase/sql/000_test_events.sql` earlier), then confirm in Table Editor
that `public.conversations` and `public.messages` exist with the columns
above.

### Why `locals.supabase`, not `src/lib/server/supabase.ts`

This is the one place those two Supabase clients' difference actually
matters: `src/lib/server/conversations.ts` (used by every
`/api/conversations*` route) takes `locals.supabase` — the request-scoped,
`@supabase/ssr`-backed client from `src/hooks.server.ts` — as a parameter,
**not** the anon-key-only client in `src/lib/server/supabase.ts`.
`locals.supabase` carries the logged-in user's JWT (from their session
cookie), so Postgres's `auth.uid()` resolves correctly inside RLS policies.
The plain anon client has no user context at all — using it here would make
every RLS check fail closed (or, if RLS were accidentally disabled, fail
_open_ to every user's data). Every read in `src/lib/server/conversations.ts`
relies on RLS for scoping — none of them add their own `.eq('user_id', ...)`
filter, by design.

### API (`src/routes/api/conversations*`)

- `GET /api/conversations` — the current user's sessions, most recently
  active first.
- `POST /api/conversations` — starts a new session, returns its `id`.
- `GET /api/conversations/[id]` — one session's metadata + all its messages,
  oldest first. A missing id and someone-else's id both come back as a
  plain 404 (`src/lib/server/conversations.ts`'s `getConversationWithMessages`)
  — RLS already made them indistinguishable at the database level, so the
  API doesn't leak the difference either.
- `POST /api/conversations/[id]/messages` — appends one `{ role, content }`
  message (Zod-validated via `createMessageRequestSchema`,
  `src/lib/schemas.ts`) and bumps the parent session's `updated_at`.

All four use `apiError()` (`src/lib/server/errors.ts`) for consistent
`{ error, info }` responses, same as `/api/asr` and `/api/ai`.

### UI wiring

- **`src/routes/+page.svelte`** — `startConversationSession()` runs inside
  `handleSuccess()` (the same moment `RealtimeVoice.connect()` is called),
  creating one `conversations` row per "Start"/"Restart" press and storing
  its id in `currentConversationId`. `persistMessage(role, content)` is
  called from `handleUserTranscript` (voice), `handleAssistantDone`
  (finalized assistant replies — not every streaming delta), and the typed
  fallback in `sendMessage`. All of this is **fire-and-forget**: a failed
  save logs a line to the debug panel (`pushLog`) but never blocks or
  interrupts the live conversation.
- **`src/routes/history/+page.svelte`** (guarded by
  `src/routes/history/+page.server.ts`, same pattern as the root page) — a
  session list (left) + session detail (right) view. Selecting a session
  fetches its messages and reuses the existing
  `src/lib/components/ChatLog.svelte` bubble UI (mapping `content → text`)
  instead of re-implementing message rendering.
- **`src/routes/+layout.svelte`** — adds a "History" link next to the
  logged-in user's email.

### Known limitations (intentional, for this pass)

- No delete/rename UI for sessions (the DB has no update/delete policy for
  `messages` at all, and no route exposes `conversations`' update policy
  yet).
- System/debug-role messages are stored (the schema supports `role: 'system'`)
  but not rendered in `/history` yet — `ChatLog.svelte` only styles
  `user`/`assistant`. Nothing currently writes `role: 'system'` messages
  either; that's for a future debug-trail feature, not this pass.
- `/practice` (Voice Battle) is untouched — it still uses Prisma/SQLite and
  the anonymous cookie, not this Supabase conversation history.

## Voice Battle & persistence

`/practice` is a small gamified layer on top of the same ASR pipeline:
record one short utterance, get it graded 0-100 by an LLM judge, and see
where you land on a shared leaderboard. Unlike the conversation flow above,
this needs **real, shared persistence** — a leaderboard only means something
if everyone's scores live in the same place, not just each visitor's own
browser.

### Data layer

- **Prisma** + **SQLite** (`prisma/schema.prisma`, `DATABASE_URL` env var,
  file lives at `dev.db` in the project root, gitignored). SQLite is fine for local dev
  and a single-instance deploy; swap `provider`/`url` in the schema to
  Postgres (e.g. Vercel Postgres/Neon) for a real multi-instance production
  deploy — the schema itself doesn't need to change.
- Two models: `Account` (one row per browser, see below) and `Battle` (one
  row per graded recording, with `accountId`, `transcript`, `points`,
  `feedback`, `durationMs`, `createdAt`).
- `src/lib/server/db.ts` exports a cached `PrismaClient` singleton (avoids
  reconnecting on every Vite HMR reload in dev).

### Accounts (anonymous, not a real login)

- `src/hooks.server.ts` runs on every request: if the visitor doesn't have
  an `ns_account` cookie, it creates an `Account` row and sets a signed,
  **httpOnly** cookie holding the internal `Account.id`. `event.locals.accountId`
  / `event.locals.accountDisplayId` are populated for every route after that.
- The httpOnly cookie means the account identity can't be read or forged
  from client JS — a learner can't just edit `localStorage` to fake a
  higher score, unlike a fully client-side version of this feature.
- The public-facing ID shown in the UI (`NS-A1B2C3D4`, `src/lib/server/account.ts`)
  is intentionally separate from the internal Prisma ID.
- This is device/browser identity, not a real account system — no
  email/password, no cross-device sync. If real login is ever wanted, the
  natural upgrade path is to link an `Account` row to a real auth provider
  instead of only a cookie.

### `POST /api/battle`

Accepts a raw `audio/webm` binary body, same validation shape as `/api/asr`,
plus an `X-Recording-Duration-Ms` header (client-reported clip length, used
as scoring context only — never trusted for anything security-sensitive).

1. Transcribes the clip (shared `transcribeAudio()` helper in
   `src/lib/server/transcribe.ts`, used by both `/api/asr` and `/api/battle`).
2. Grades the transcript via `scoreBattle()` (`src/lib/server/scoring.ts`) —
   a Chat Completions call with `JUDGE_MODEL` (defaults to `gpt-4o-mini`,
   a plain text model — no audio in or out here) and
   `response_format: { type: "json_object" }`, returning
   `{ fluency, vocabulary, grammar, overall, feedback }` each 0-100.
3. Saves a `Battle` row for `locals.accountId` with `points = score.overall`.
4. Returns `{ transcript, score, points, stats }`, where `stats` is the same
   shape as `GET /api/me` — so the client can update the UI from one response
   without a second round trip.

### `GET /api/me`

Returns the current account's stats: `{ id, totalPoints, battleCount, rank,
totalAccounts, history }`, where `history` is the account's most recent
battles. Rank/totals are computed live via `prisma.battle.groupBy` in
`src/lib/server/leaderboard.ts` — there's no separately-maintained counter
that could drift out of sync.

### `GET /api/leaderboard`

Returns `{ leaderboard: [{ rank, id, totalPoints, battles }, ...] }` for the
top 20 accounts by total points, using the same ranking helper as `/api/me`.

### `/practice` page

Reuses `VoiceRecorder.svelte` (the bounded record/review/send component from
the original v1 flow — a good fit here since a "battle" is one bounded
utterance, not an open-ended conversation) wired to `POST /api/battle`
instead of `/api/asr` + `/api/ai`. Shows the account's rank/points/battle
count, the graded result with a feedback tip, battle history, and the
leaderboard (with the current account highlighted).

The landing page (`/`) shows a compact "Voice Battle" card (rank + points +
a link into `/practice`), loaded via the same `GET /api/me`.

## Security and best practices

- **Never commit real keys.** `.env` is gitignored; `.env.example` must only
  ever contain empty values or obviously-fake placeholders.
- **All OpenAI calls go through our server routes, with one sanctioned
  exception:** the live Realtime/WebRTC connection. There, the browser talks
  directly to `api.openai.com/v1/realtime/calls`, but only ever with a
  short-lived **ephemeral token** (`ek_...`) minted server-side by
  `GET /api/realtime/session` — the real `OPENAI_API_KEY` never leaves the
  server. Every other OpenAI capability (transcription, text/audio chat
  replies) still goes through our own `/api/...` routes. No API key is ever
  present in bundled client JS.
- **Input validation is mandatory on every route**, existing or new:
  - Zod schema validation for JSON bodies (`src/lib/schemas.ts`).
  - `content-type` checks (reject the wrong type with `415`).
  - Size caps on every body (reject oversized payloads with `413`).
  - Consistent error shape: `{ "error": "..." }` with an appropriate 4xx/5xx
    status — don't invent a new error shape per route.
- **Docs change under you.** OpenAI's recommended models and endpoints have
  already shifted once during this project (Whisper → `gpt-transcribe`,
  Chat Completions → Responses API). Before changing a model name or
  endpoint, re-check the current docs rather than trusting old comments or
  blog posts:
  - Text generation / Responses API: TODO — confirm current guide URL under
    `https://developers.openai.com/api/docs/guides/text-generation`.
  - Speech-to-text / transcription: TODO — confirm current guide URL under
    `https://developers.openai.com/api/docs/guides/speech-to-text`.
  - Realtime: TODO — confirm current guide URL under
    `https://developers.openai.com/api/docs/guides/realtime`.

  (Links above were correct as of this doc's last update — treat them as a
  starting point and verify, not gospel.)

## Developer checklist

- [ ] If you add a new route: enforce input validation (Zod + content-type +
      size cap) and confirm no secrets are read outside `+server.ts` /
      `src/lib/server/*`.
- [ ] If you change models: update the relevant env var (`MODEL_NAME`,
      `COACH_VOICE`, `TRANSCRIBE_MODEL`, `REALTIME_MODEL`, `REALTIME_VOICE`,
      `JUDGE_MODEL`, or a new one) in **both** `.env.example` and this doc —
      don't let them drift.
- [ ] If you change `prisma/schema.prisma`: run
      `npx prisma migrate dev --name <description>` to create a migration,
      and commit the generated `prisma/migrations/` folder (but never
      `dev.db` itself — that stays gitignored).
- [ ] Test with curl before trusting the UI: - `curl http://localhost:5173/api/health` - `curl http://localhost:5173/api/realtime/session` (should return `{ "value": "ek_...", "expiresAt": ... }`) - `curl -X POST http://localhost:5173/api/ai -H "content-type: application/json" -d '{"message":"Hi"}'` - `curl -X POST http://localhost:5173/api/asr -H "content-type: audio/webm" --data-binary @sample.webm` - `curl http://localhost:5173/api/me` and `curl http://localhost:5173/api/leaderboard`
      (note: without a browser's cookie jar, curl gets a fresh anonymous
      account on every call — pass `-c cookies.txt -b cookies.txt` to
      persist one across requests)
- [ ] Verify the UI end-to-end: click "Start conversation" → grant mic
      access → `RealtimeVoice` shows "Live — just start talking" → speak a
      sentence → it appears as a user message → the tutor's reply streams in
      as an assistant message **and** you hear it play automatically → try
      the text input too (should reply the same way through the live
      session) → debug panel shows connection/session events.
- [ ] If you touch auth: confirm `/` still redirects to `/login` when logged
      out, and that `/login`/`/signup` redirect _away_ when already logged
      in. Sign up with a real inbox and confirm the email link lands back
      on the **same origin you signed up from** (local vs. deployed), not
      the other one — see "Supabase dashboard configuration" above if it
      doesn't. Never hardcode `localhost` in a redirect URL; always go
      through `getSiteUrl()`/`getAuthCallbackUrl()` (`src/lib/auth/redirects.ts`)
      or `window.location.origin`.
- [ ] If you touch conversation history: run `database/create_conversation_tables.sql`
      in Supabase before testing, confirm RLS is still enabled on both
      tables (Table Editor → table → RLS toggle), and check that a second
      test account cannot see the first account's sessions via `GET /api/conversations`.
- [ ] Verify cleanup: click "End conversation" → header/debug panel show
      `disconnecting` then `disconnected` → debug panel logs show the data
      channel, mic tracks, and peer connection each being closed → open the
      Network tab and confirm **no** further `/api/asr`, `/api/ai`, or
      `api.openai.com` traffic fires → click "Start conversation" again and
      confirm it starts a fresh session (not a mix of old + new state).
- [ ] If you add a new client call site to `/api/asr` or `/api/ai`, wrap it
      with `reportApiCall()` from `src/lib/apiInstrumentation.ts` so a stray
      call after disconnect shows up as a warning instead of silently
      succeeding.
- [ ] If a call fails, check the server terminal output (not just the
      browser) — errors are logged server-side via `console.error` and
      never leak OpenAI error internals to the client response. For Realtime
      issues specifically, also check the browser console/devtools for
      WebRTC connection errors, since that leg never touches our server.
