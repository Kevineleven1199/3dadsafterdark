# SignalScope Platform

SignalScope is a full-stack, multi-tenant investigation platform with a real daily remote-viewing engine.
Targets are generated on the day, hidden until the next day, then scored for win/loss records.

## Stack

- Frontend: static HTML/CSS/JS in `/public`
- Backend: Node HTTP server in `/server.js`
- Persistence: JSON datastore in `DATA_DIR/store.json`
- Runtime deps: none (Node 18+)

## Core Features

- User auth: register, login, logout, bearer sessions
- Multi-tenant communities with creation from UI
- Feed system: posts, comments, upvotes, filtering/sorting
- Caseboard: create cases, toggle tasks
- Daily remote viewing:
  - Real AI target generation with failover prompt chain: `Anthropic -> OpenRouter -> OpenAI`
  - Real AI image generation with failover chain: `OpenRouter -> OpenAI`
  - If image APIs are unavailable, AI-generated SVG target fallback is used (still model-generated)
  - Day-of generation with delayed reveal next day (UTC day boundary)
  - Prediction submission per user per day
  - AI win/loss scoring with failover chain: `Anthropic -> OpenRouter -> OpenAI`
  - Personal record + leaderboard
  - Frontload endpoint for a month (or custom span) of rounds
  - Reserve image pool endpoint to pre-generate emergency backup targets
  - Automatic reserve takeover if live daily image generation fails
  - Parallel experiment tracks:
    - `dynamic` track: image generated at a fixed daily UTC schedule (default 08:55 UTC)
    - `preloaded` track: up to 365-day preloaded control images
    - side-by-side scoring and win-rate delta comparison
  - Optional X auto-posting for revealed rounds

## No Template Mock Data

- Legacy template seed data is automatically purged on startup.
- New stores initialize with an empty operational tenant and no fake posts/cases/users.
- All remote-viewing targets and scoring are produced by real model API calls.

## Required Environment Variables

At least one full provider chain is needed:

- Prompt + judge chain: `ANTHROPIC_API_KEY` and/or `OPENROUTER_API_KEY` and/or `OPENAI_API_KEY`
- Image chain: `OPENROUTER_API_KEY` and/or `OPENAI_API_KEY`

## Optional Environment Variables

- `HOST` (default `0.0.0.0`)
- `PORT` (default `3000`)
- `DATA_DIR` (default `./data`)
- `PUBLIC_BASE_URL` (used for links in X posts)
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_BASE_URL` (default `https://api.anthropic.com/v1`)
- `ANTHROPIC_TEXT_MODEL` (default `claude-3-5-sonnet-latest`)
- `ANTHROPIC_JUDGE_MODEL` (default same as `ANTHROPIC_TEXT_MODEL`)
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`)
- `OPENROUTER_TEXT_MODEL` (default `anthropic/claude-3.5-sonnet`)
- `OPENROUTER_JUDGE_MODEL` (default same as `OPENROUTER_TEXT_MODEL`)
- `OPENROUTER_IMAGE_MODEL` (default `openai/gpt-image-1`)
- `OPENROUTER_APP_NAME` (default `SignalScope`)
- `OPENROUTER_APP_URL` (default `https://signalscope.local`)
- `OPENAI_BASE_URL` (default `https://api.openai.com/v1`)
- `OPENAI_IMAGE_MODEL` (default `gpt-image-1`)
- `OPENAI_TEXT_MODEL` (default `gpt-4o-mini`)
- `OPENAI_JUDGE_MODEL` (default `gpt-4o-mini`)
- `X_AUTOPOST_ENABLED=true|false`
- `X_AUTOPOST_INTERVAL_MS` (default `900000`)
- `X_API_BASE_URL` (default `https://api.x.com`)
- `X_API_KEY`, `X_API_KEY_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`
- `PARALLEL_DYNAMIC_GENERATE_HOUR_UTC` (default `8`)
- `PARALLEL_DYNAMIC_GENERATE_MINUTE_UTC` (default `55`)
- `PARALLEL_PRELOAD_DEFAULT_DAYS` (default `365`)

## Run Locally

```bash
ANTHROPIC_API_KEY=... OPENROUTER_API_KEY=... npm start
```

With custom host/port/data dir:

```bash
ANTHROPIC_API_KEY=... OPENROUTER_API_KEY=... HOST=127.0.0.1 PORT=3001 DATA_DIR=/absolute/path/to/data npm start
```

## Railway Deployment

1. Push to GitHub.
2. Create a Railway project from this repo.
3. Add a Railway Volume and mount it at `/data`.
4. Set env vars:
   - `DATA_DIR=/data`
   - `ANTHROPIC_API_KEY=...`
   - `OPENROUTER_API_KEY=...`
   - optional X integration vars if you want auto-posting
5. Deploy.

## API Endpoints

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/tenants`
- `POST /api/tenants`
- `GET /api/tenants/:id`
- `GET /api/tenants/:id/posts?filter=all|video|podcast|meme|brief&sort=hot|new|clues`
- `POST /api/tenants/:id/posts`
- `POST /api/posts/:id/upvote`
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments`
- `GET /api/tenants/:id/cases`
- `POST /api/tenants/:id/cases`
- `PATCH /api/tasks/:id`
- `GET /api/remote-viewing/daily`
- `POST /api/remote-viewing/predictions`
- `POST /api/remote-viewing/frontload`
- `POST /api/remote-viewing/reserve/frontload`
  - Body: `{ "targetAvailable": 30 }` (tops up unused reserve images to target)
- `GET /api/remote-viewing/parallel/daily`
- `POST /api/remote-viewing/parallel/predictions`
  - Body: `{ "track": "dynamic" | "preloaded", "prediction": "..." }`
- `POST /api/remote-viewing/parallel/frontload-preloaded`
  - Body: `{ "days": 365, "startDate": "YYYY-MM-DD" }` (`startDate` optional)
- `GET /api/remote-viewing/parallel/rounds/:id/image`
- `GET /api/remote-viewing/rounds/:id/image`
- `POST /api/remote-viewing/rounds/:id/x-post`
