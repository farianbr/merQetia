import { useEffect } from 'react';
import AuthedImage from './AuthedImage';

export default function ImageLightbox({ src, name, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={name}>
      <button className="lightbox-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close lightbox">
        &#x2715;
      </button>
      <AuthedImage
        src={src}
        alt={name}
        className="lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
      {name && <span className="lightbox-name">{name}</span>}
    </div>
  );
}
