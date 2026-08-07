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

| Event | Meaning |
|---|---|
| `conversation.item.input_audio_transcription.completed` | What the learner said (finalized) |
| `response.output_audio_transcript.delta` / `.done` | The tutor's spoken reply, streamed then finalized |
| `input_audio_buffer.speech_started` / `.stopped` | Turn-taking, logged to the debug panel |
| `error` | Surfaced via `onerror` and logged |

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

| Var | Purpose | Example |
|---|---|---|
| `OPENAI_API_KEY` | Server-side OpenAI auth. Never sent to the browser. | `sk-proj-...` |
| `MODEL_NAME` | Audio-capable Chat Completions model for `/api/ai`. | `gpt-audio-1.5` |
| `COACH_VOICE` | Voice preset for the coach's spoken reply in `/api/ai`. | `alloy` |
| `TRANSCRIBE_MODEL` | Transcription model for `/api/asr`. | `gpt-transcribe` |
| `REALTIME_MODEL` | Model for the live Realtime/WebRTC session (`/api/realtime/session`). | `gpt-realtime-2.1` |
| `REALTIME_VOICE` | Voice preset for the tutor's live spoken replies. Options: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`. | `marin` |
| `ORIGIN_URL` | Local/prod origin, reserved for CORS/redirect config as the app grows. | `http://localhost:5173` |

`.env` holds real values and is gitignored. `.env.example` mirrors the same
keys with empty/placeholder values and **is** committed — never put a real
key in `.env.example`.

> **Known gotcha:** `MODEL_NAME` must be an audio-capable Chat Completions
> model (e.g. `gpt-audio-1.5`), not a plain text model like `gpt-4o` and not
> a Realtime-only model like `gpt-4o-realtime-preview`. A plain text model
> will reject `modalities: ["text", "audio"]`, and a Realtime-only model
> isn't valid for `/v1/chat/completions` at all. Both fail with a 502 from
> `/api/ai` (check the server terminal for the underlying OpenAI error).

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
      or a new one) in **both** `.env.example` and this doc — don't let them
      drift.
- [ ] Test with curl before trusting the UI:
      - `curl http://localhost:5173/api/health`
      - `curl http://localhost:5173/api/realtime/session` (should return `{ "value": "ek_...", "expiresAt": ... }`)
      - `curl -X POST http://localhost:5173/api/ai -H "content-type: application/json" -d '{"message":"Hi"}'`
      - `curl -X POST http://localhost:5173/api/asr -H "content-type: audio/webm" --data-binary @sample.webm`
- [ ] Verify the UI end-to-end: click "Start conversation" → grant mic
      access → `RealtimeVoice` shows "Live — just start talking" → speak a
      sentence → it appears as a user message → the tutor's reply streams in
      as an assistant message **and** you hear it play automatically → try
      the text input too (should reply the same way through the live
      session) → debug panel shows connection/session events.
- [ ] If a call fails, check the server terminal output (not just the
      browser) — errors are logged server-side via `console.error` and
      never leak OpenAI error internals to the client response. For Realtime
      issues specifically, also check the browser console/devtools for
      WebRTC connection errors, since that leg never touches our server.
