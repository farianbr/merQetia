import api from '../api/axios';

// Media URL handling.
//
// Avatars are PUBLIC: stored as absolute R2 URLs (prod) or relative /uploads
// paths (dev). `mediaUrl()` resolves them for a plain <img src>.
//
// Attachments are PRIVATE: stored as authorized API proxy paths (e.g.
// `/orders/<id>/files/<name>`). They can't be loaded via a plain <img> because
// the JWT lives in an Authorization header, so `fetchMedia()` pulls them through
// axios and hands back an in-memory blob URL. See <AuthedImage> / downloadMedia.

export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
  .replace(/\/api\/?$/, '');

/** Resolve a PUBLIC media reference (avatar) for a plain <img src>. */
export function mediaUrl(ref) {
  if (!ref) return null;
  if (/^(https?:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('blob:')) {
    return ref;
  }
  return `${API_BASE}${ref.startsWith('/') ? '' : '/'}${ref}`;
}

// Dedupe in-flight/loaded blobs so the same file isn't refetched per render.
const blobCache = new Map(); // path -> Promise<objectURL>

/** Fetch a PRIVATE attachment via axios and return a blob object URL. */
export function fetchMedia(path) {
  if (!path) return Promise.resolve(null);
  if (path.startsWith('blob:') || path.startsWith('data:')) return Promise.resolve(path);
  if (blobCache.has(path)) return blobCache.get(path);

  const promise = api
    .get(path, { responseType: 'blob' })
    .then((res) => URL.createObjectURL(res.data))
    .catch((err) => {
      blobCache.delete(path);
      throw err;
    });

  blobCache.set(path, promise);
  return promise;
}

/** Download a PRIVATE attachment with its original filename. */
export async function downloadMedia(path, filename) {
  const objectUrl = await fetchMedia(path);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
