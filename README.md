# SignalScope Platform

SignalScope is now a real multi-tenant collaboration platform for internet investigations.
It includes persistent backend APIs, account auth, tenant management, and API-driven discussion feeds.

## Stack

- Frontend: static HTML/CSS/JS in `/public`
- Backend: Node HTTP server in `/server.js`
- Persistence: JSON datastore at `/data/store.json` (auto-created on first run)
- Runtime deps: none (Node 18+)

## Real Features Implemented

- User authentication (register, login, logout, session token)
- Multi-tenant communities with server-side data
- Tenant creation from the UI
- API-backed feed (videos, podcasts, memes, briefs)
- Post publishing to active tenant
- Upvotes and threaded comment replies per post
- Shared caseboard with server-backed tasks and toggle state
- New case creation from the UI
- Data persists across server restarts

## Demo Account

- Email: `demo@signalscope.local`
- Password: `demo1234`

## Run Locally

```bash
npm start
```

Optional host/port override:

```bash
HOST=127.0.0.1 PORT=3001 npm start
```

Custom data directory:

```bash
DATA_DIR=/absolute/path/to/data npm start
```

## Deploy To Railway

1. Push this repo to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Railway will run `npm start` automatically.
4. Add a Railway Volume and mount it (example mount path: `/data`).
5. Set env var `DATA_DIR=/data` so datastore survives restarts/redeploys.
6. Deploy and open your service URL.

## API Overview

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

## Notes

- `data/store.json` is ignored by git and generated automatically.
- If you delete `data/store.json`, the app reseeds starter tenants/content on next boot.
