import { useEffect, useState } from 'react';
import { fetchMedia } from '../utils/media';

/**
 * Renders a PRIVATE attachment image. Fetches the bytes through axios (so the
 * JWT Authorization header is sent) and displays the resulting blob URL.
 * Renders nothing until the image is available. Extra props (className, onClick,
 * etc.) are forwarded to the underlying <img>.
 */
export default function AuthedImage({ src, alt, ...rest }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    let active = true;
    setObjectUrl(null);
    if (!src) return undefined;
    fetchMedia(src)
      .then((url) => { if (active) setObjectUrl(url); })
      .catch(() => { if (active) setObjectUrl(null); });
    return () => { active = false; };
  }, [src]);

  if (!objectUrl) return null;
  return <img src={objectUrl} alt={alt} {...rest} />;
}
