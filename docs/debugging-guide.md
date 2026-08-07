# NeuSpeak — How to Report a Bug

A quick guide for students/testers and junior devs. Goal: give whoever picks
up the bug everything they need without a back-and-forth.

## 1. Steps to reproduce

Write it like a recipe someone else can follow with zero context:

```
1. Go to /practice
2. Click "Record"
3. Say "hello" and click "Stop"
4. Click "Send"

Expected: a score appears within a few seconds.
Actual: the page shows "Voice battle judging is unavailable right now".
```

Include the URL, browser + OS (e.g. "Chrome 126 on Windows 11"), and whether
it happens every time or only sometimes.

## 2. Capture browser Console errors

1. Open DevTools (`F12` or `Ctrl+Shift+I`), go to the **Console** tab.
2. Reproduce the bug.
3. Right-click the red error → **Copy message** (or select the text and copy).
4. Paste it into the bug report as a code block.

**Redact before sharing:** scan for anything that looks like a real API key
(`sk-...`), a full email address, or a token — replace it with `[REDACTED]`.
NeuSpeak's `OPENAI_API_KEY` should never appear in browser console output at
all (it's server-only) — if you ever see it there, that's a bug on its own
and should be flagged immediately.

## 3. Capture Network tab details for `/api/...` requests

1. DevTools → **Network** tab → reproduce the bug.
2. Find the failing request (filter by `api` in the search box).
3. Click it and note:
   - **Status** (e.g. `502`, `413`)
   - **Response** tab — copy the JSON body (should look like `{ "error": "...", "info": "..." }`)
   - **Request** tab — the method, and for JSON requests, the request payload
     (redact the `message` text if it contains anything personal)
4. Also check the **in-app debug panel** (visible in dev, bottom of the
   page) — it already tracks the last call to `/api/health`, `/api/asr`,
   and `/api/ai` (status + short message + timestamp), which is often faster
   than digging through the Network tab.

## 4. Before reporting: quick local checks

- **`.env`** — confirm `OPENAI_API_KEY` is set and not a placeholder. Missing
  keys usually show up as a `401`/`403` from the API routes (info:
  `upstream_auth_error`).
- **Restart the dev server** — `.env` changes don't hot-reload; stop
  `npm run dev` and start it again after editing `.env`.
- **Server logs** — the terminal running `npm run dev` prints one line per
  API error: route, status, and a high-level reason (e.g.
  `[POST /api/ai] 502 OpenAI request failed`). This never includes secrets —
  safe to paste into a bug report as-is.

## Checklist before filing

- [ ] Can you reproduce it **3 times** with the same steps?
- [ ] Do you see the error in the **in-app debug panel**?
- [ ] Have you **removed any secrets** (API keys, tokens, emails) from
      everything you're about to paste?

If all three are checked, you're ready to file the bug.
