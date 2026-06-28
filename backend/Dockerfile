# Backend image for Render (or any container host).
# Uses system Chromium so Puppeteer can render invoice PDFs reliably —
# Render's native Node runtime is missing the shared libraries Chromium needs.
FROM node:20-bookworm-slim

# Chromium + the libraries/fonts Puppeteer needs to launch headless.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      libnss3 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdrm2 \
      libgbm1 \
      libasound2 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libxkbcommon0 \
      libpango-1.0-0 \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Use the system Chromium and skip Puppeteer's own download.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
