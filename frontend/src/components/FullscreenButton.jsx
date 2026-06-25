import { useEffect } from 'react';
import { LuMaximize2, LuMinimize2 } from 'react-icons/lu';

/**
 * Toggles a conversation panel into/out of a full-screen overlay. The parent
 * holds the boolean state and applies the `conv-fs` class to the panel it wants
 * expanded; this button flips it and also exits on Escape while active.
 */
export default function FullscreenButton({ active, onToggle, className = '' }) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onToggle(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onToggle]);

  return (
    <button
      type="button"
      className={`conv-fs-btn ${className}`}
      onClick={() => onToggle(!active)}
      title={active ? 'Exit full screen' : 'Full screen'}
      aria-label={active ? 'Exit full screen' : 'Full screen'}
    >
      {active ? <LuMinimize2 size={15} /> : <LuMaximize2 size={15} />}
    </button>
  );
}
