# 3 Dads After Dark Website

Premium, cinematic, no-database podcast site built for Railway deployment.

## Stack

- Static frontend (`public/index.html`, `public/styles.css`, `public/main.js`)
- Tiny Node static server (`server.js`)
- No runtime dependencies

## Experience Highlights

- Full-screen splash intro with alien abduction visuals
- Animated UFO, tractor beam, and ambient cosmic motion
- Premium responsive sections for episodes, brand story, and sponsorship CTA
- Lightweight implementation using plain HTML/CSS/JS

## Run locally

```bash
npm start
```

Optional host/port override:

```bash
HOST=127.0.0.1 PORT=3001 npm start
```

## Deploy on Railway

1. Push this project to GitHub.
2. In Railway, create a new project from that GitHub repo.
3. Railway will detect `package.json` and run `npm start`.
4. Set the service domain in Railway and publish.

Railway provides `PORT` automatically, and this server uses it.
