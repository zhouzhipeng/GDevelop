# GDevelop "My Cloud" — self-hosted project server

Store and share your GDevelop projects on **your own server** instead of GDevelop Cloud.

This is the server side of the **My Cloud** storage provider in the GDevelop IDE. The exact same
code runs **embedded** inside the GDevelop desktop app (on `127.0.0.1`, no setup needed) and as a
**standalone** server you can deploy on a VPS / Docker / home server to act as a real shared cloud.

## What it does

- Stores each project as an archive (the IDE zips `game.json` + assets) on the filesystem.
- Stores uploaded resources (images, audio, fonts) and serves them back with stable URLs.
- Gives every project a **share link** (`/share/:id`) with:
  - **▶ Play** — runs the game in the browser (when an HTML5 build has been shared), and
  - **⬇ Download** — downloads the project to open in any GDevelop.

## Run it

### Plain Node

```bash
cd my-cloud-server
npm install
MY_CLOUD_TOKEN=choose-a-strong-secret PORT=3030 npm start
```

### Docker

```bash
docker build -t gdevelop-my-cloud .
docker run -d --name gd-cloud \
  -e MY_CLOUD_TOKEN=choose-a-strong-secret \
  -e MY_CLOUD_BASE_URL=https://cloud.example.com \
  -p 3030:3030 \
  -v gd-cloud-data:/data \
  gdevelop-my-cloud
```

## Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3030` | Port to listen on. |
| `HOST` | `0.0.0.0` | Interface to bind. |
| `MY_CLOUD_TOKEN` | _(none)_ | Shared access token the IDE must send. **If unset, the server is open** — only acceptable on localhost / a trusted LAN. |
| `MY_CLOUD_DATA_DIR` | `./data` | Where projects are stored. |
| `MY_CLOUD_BASE_URL` | _(request Host)_ | Public base URL used to build resource links, e.g. `https://cloud.example.com`. |

## Connect the GDevelop IDE to it

1. In GDevelop, open **Preferences → My Cloud server**.
2. Set **Server URL** to e.g. `https://cloud.example.com` (or `http://localhost:3030`).
3. Set **Access token** to the same value as `MY_CLOUD_TOKEN`.
4. Click **Test connection**.
5. Now when you **Save** a project, choose **My Cloud** as the destination.

> On the **desktop app**, an embedded My Cloud server runs automatically on localhost with no token,
> so "My Cloud" works out of the box without any of the above. The settings are only needed to point
> at a **remote** server.

## Security notes

- The access token is a **bearer secret**. For any remote deployment, run the server behind **HTTPS**
  (a reverse proxy such as Caddy/nginx) so the token isn't sent in clear text.
- Share links (`/share`, `/play`, `/download`) are intentionally **public and unauthenticated** —
  anyone with the link can play/download that one project. Don't share links for private projects.

## API (for reference)

Token-protected (send `Authorization: Bearer <token>`):

```
GET    /api/health
GET    /api/projects
POST   /api/projects                 { name, gameId? }
GET    /api/projects/:id
PATCH  /api/projects/:id             { name?, gameId? }
DELETE /api/projects/:id
GET    /api/projects/:id/archive     -> application/zip
POST   /api/projects/:id/archive     (raw zip bytes) -> { version }
POST   /api/projects/:id/resources   (raw bytes ?filename=&sha=) -> { url }
POST   /api/projects/:id/export      (raw HTML5-export zip) -> { ok, playUrl }
```

Public:

```
GET /resources/:id/:storedName
GET /share/:id
GET /download/:id
GET /play/:id/*
```
