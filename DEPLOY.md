# Deployment (Render)

The repo ships a [`render.yaml`](render.yaml) Blueprint: a Dockerized backend API and a
static frontend. Point Render at this repo ("New + → Blueprint") and fill in the
`sync: false` secrets in the dashboard.

## File storage — Cloudflare R2 (two buckets)

Uploads are stored in S3-compatible Cloudflare R2 via the AWS S3 SDK. **R2 is required** —
the server refuses to start without the R2 env vars (there is no local-disk fallback, and
Render's filesystem is ephemeral anyway).

R2 public access is bucket-level, so storage is split by sensitivity:

- **Private bucket (`R2_BUCKET`)** — chat/order attachments (confidential). Public access
  stays **off**. Files are never given a public URL; the backend streams them only to
  authorized users (`GET /api/orders/:id/files/:name`, `GET /api/team/channels/:id/files/:name`),
  reusing the same authorization as the order/channel they belong to. The frontend
  fetches these through axios (so the JWT is sent) and renders them as in-memory blobs
  (`AuthedImage` / `downloadMedia`).
- **Public bucket (`R2_PUBLIC_BUCKET`)** — avatars only (low-sensitivity profile photos).
  Enable public access and set `R2_PUBLIC_URL` so the browser can load cacheable `<img>`.

Setup:
1. Create two R2 buckets (e.g. `merqetia-attachments`, `merqetia-avatars`).
2. Enable public access on the **avatar** bucket only (r2.dev URL or a custom domain);
   keep the attachment bucket private.
3. Create one R2 API token (Object Read & Write) → access key id + secret (covers both).
4. Set the backend env vars (see [`backend/.env.example`](backend/.env.example)):
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET` (private), `R2_PUBLIC_BUCKET` (public), `R2_PUBLIC_URL` (no trailing slash)

No frontend env change is needed: avatar URLs are absolute (passed through by `mediaUrl()`),
and attachments use relative API paths fetched via the authenticated axios client.

## PDF generation (Puppeteer / Chromium)

Invoice PDFs are rendered with Puppeteer. Render's native Node runtime is missing the
shared libraries Chromium needs, so the backend runs as a **Docker** service
([`backend/Dockerfile`](backend/Dockerfile)) that installs system Chromium and points
`PUPPETEER_EXECUTABLE_PATH` at it. Use at least the `starter` plan — Chromium needs more
RAM than the free tier provides.

Locally (no Docker) Puppeteer uses the Chromium it downloads on `npm install`, cached in
`backend/.cache/puppeteer` (see [`backend/.puppeteerrc.cjs`](backend/.puppeteerrc.cjs)).
Set `PUPPETEER_EXECUTABLE_PATH` (or `CHROME_PATH`) to use a specific browser binary.

## CORS / URLs

- Backend `ALLOWED_ORIGINS` = the frontend origin (comma-separated for multiple).
- Frontend `VITE_API_URL` = the backend URL incl. `/api`, e.g. `https://merqetia-api.onrender.com/api`.
- Backend `APP_URL` = the frontend URL (used in invite/email links).
