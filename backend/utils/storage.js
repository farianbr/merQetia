const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

/**
 * File storage backed by Cloudflare R2 (S3-compatible). R2 is REQUIRED — there
 * is no local-disk fallback (Render's filesystem is ephemeral anyway).
 *
 * Two buckets, because R2 public access is bucket-level:
 *   - PRIVATE bucket (R2_BUCKET): chat/order attachments — confidential. Never
 *     publicly reachable; streamed to authorized users via getObject().
 *   - PUBLIC bucket (R2_PUBLIC_BUCKET): avatars — low-sensitivity profile photos
 *     served directly from R2_PUBLIC_URL so the browser can cache plain <img>.
 */

const missing = [
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BUCKET',
  'R2_PUBLIC_URL',
].filter((k) => !process.env[k]);
if (!process.env.R2_ENDPOINT && !process.env.R2_ACCOUNT_ID) {
  missing.push('R2_ENDPOINT (or R2_ACCOUNT_ID)');
}
if (missing.length) {
  throw new Error(`Storage misconfigured — missing R2 env vars: ${missing.join(', ')}`);
}

const s3 = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint:
    process.env.R2_ENDPOINT ||
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
console.log('Storage: Cloudflare R2 enabled (private + public buckets).');

const CONTENT_TYPE_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.zip': 'application/zip', '.txt': 'text/plain',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const guessContentType = (name) =>
  CONTENT_TYPE_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';

/** Build a collision-resistant, URL-safe, sanitized filename. */
const buildFilename = (originalName) => {
  const now = new Date();
  const Y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, '0');
  const D = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${Y}${M}${D}-${h}${m}`;
  const random = crypto.randomBytes(4).toString('hex');
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const baseName = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 40);
  return `${timestamp}-${random}-${baseName}${ext}`;
};

const cleanKey = (prefix, name) => `${String(prefix).replace(/^\/+|\/+$/g, '')}/${name}`;

/**
 * Persist a PRIVATE file (attachment). Returns the storage key — the file is
 * only ever delivered through an authorized stream route, never a public URL.
 * @returns {Promise<{ filename: string, key: string }>}
 */
const saveFile = async (buffer, { prefix, originalName, mimetype, filename }) => {
  const name = filename || buildFilename(originalName);
  const key = cleanKey(prefix, name);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype || guessContentType(name),
  }));
  return { filename: name, key };
};

/**
 * Persist a PUBLIC file (avatar). Returns an absolute public URL suitable for a
 * plain <img src>.
 * @returns {Promise<{ filename: string, url: string, key: string }>}
 */
const savePublicFile = async (buffer, { prefix, originalName, mimetype, filename }) => {
  const name = filename || buildFilename(originalName);
  const key = cleanKey(prefix, name);
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_PUBLIC_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimetype || guessContentType(name),
  }));
  const base = process.env.R2_PUBLIC_URL.replace(/\/+$/, '');
  return { filename: name, url: `${base}/${key}`, key };
};

/**
 * Open a PRIVATE object for streaming to an authorized client.
 * @returns {Promise<{ stream: NodeJS.ReadableStream, contentType: string, contentLength: number }>}
 */
const getObject = async (key) => {
  const clean = key.replace(/^\/+/, '');
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: clean }));
    return {
      stream: res.Body,
      contentType: res.ContentType || guessContentType(clean),
      contentLength: res.ContentLength,
    };
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      const e = new Error('File not found');
      e.statusCode = 404;
      throw e;
    }
    throw err;
  }
};

/** Best-effort delete of a stored object. */
const deleteFile = async (key, { public: isPublic = false } = {}) => {
  if (!key) return;
  const Bucket = isPublic ? process.env.R2_PUBLIC_BUCKET : process.env.R2_BUCKET;
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key.replace(/^\/+/, '') }));
};

module.exports = { saveFile, savePublicFile, getObject, deleteFile, buildFilename };
