const multer = require('multer');
const path = require('path');
const { saveFile, savePublicFile } = require('../utils/storage');

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

// Files are buffered in memory then handed to the storage layer (R2 in prod,
// local disk in dev). This keeps the app working on hosts with an ephemeral
// or read-only filesystem (e.g. Render).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: images, zip, pdf, doc, txt'), false);
    }
  },
});

/**
 * Persist any files parsed by `upload.array(...)` to PRIVATE storage.
 * Attachments are confidential and never get a public URL — they're streamed
 * to authorized users. Sets `file.filename` and `file.key` on each entry; the
 * controller builds the authorized proxy `url` from those.
 * @param {(req) => string} prefixFn Returns the storage key prefix for the request.
 */
const persistUploads = (prefixFn) => async (req, res, next) => {
  try {
    const files = req.files || [];
    for (const f of files) {
      const saved = await saveFile(f.buffer, {
        prefix: prefixFn(req),
        originalName: f.originalname,
        mimetype: f.mimetype,
      });
      f.filename = saved.filename;
      f.key = saved.key;
    }
    next();
  } catch (err) {
    next(err);
  }
};

// ── Avatar upload (profile photos) ──────────────────────────────────────────
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'), false);
    }
  },
}).single('avatar');

/**
 * Persist the parsed avatar to PUBLIC storage under a stable per-user key.
 * Avatars are low-sensitivity and shown widely, so they're served directly
 * (cacheable plain <img>) rather than proxied.
 */
const persistAvatar = async (req, res, next) => {
  try {
    if (!req.file) return next();
    const ext = path.extname(req.file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    const saved = await savePublicFile(req.file.buffer, {
      prefix: 'avatars',
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      filename: `avatar-${req.user.id}${ext}`,
    });
    // Cache-bust so a replaced avatar (same key) refreshes in the browser.
    req.file.filename = saved.filename;
    req.file.url = `${saved.url}?v=${Date.now()}`;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { upload, uploadAvatar, persistUploads, persistAvatar };
