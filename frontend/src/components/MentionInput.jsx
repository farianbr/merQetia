import { useRef, useState } from 'react';

/**
 * Find the active "@query" token directly before the caret, if any.
 * The @ must be at the start of the text or preceded by whitespace.
 */
function getActiveMention(text, caret) {
  const upto = text.slice(0, caret);
  const at = upto.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && !/\s/.test(upto[at - 1])) return null;
  const query = upto.slice(at + 1);
  if (query.includes('\n') || query.length > 30) return null;
  return { start: at, query };
}

/**
 * Single-line text input with an @mention autocomplete dropdown.
 * `participants` is the list of mentionable people ([{ _id, name, role }]).
 * Mentions are inserted as plain "@Name " text; the parent derives the
 * mentioned ids from the final text (see extractMentionIds).
 */
export default function MentionInput({
  value,
  onChange,
  participants = [],
  disabled,
  placeholder,
  className,
}) {
  const inputRef = useRef(null);
  const [menu, setMenu] = useState(null); // { start, query }
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = menu
    ? participants.filter((p) => p.name.toLowerCase().startsWith(menu.query.toLowerCase()))
    : [];
  const open = !!menu && matches.length > 0;
  const safeIndex = Math.min(activeIndex, Math.max(0, matches.length - 1));

  const sync = (text) => {
    const caret = inputRef.current?.selectionStart ?? text.length;
    setMenu(getActiveMention(text, caret));
    setActiveIndex(0);
  };

  const handleChange = (e) => {
    onChange(e.target.value);
    sync(e.target.value);
  };

  const select = (p) => {
    if (!menu) return;
    const before = value.slice(0, menu.start);
    const caret = inputRef.current?.selectionStart ?? value.length;
    const after = value.slice(caret);
    const inserted = `@${p.name} `;
    onChange(before + inserted + after);
    setMenu(null);
    const pos = (before + inserted).length;
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      select(matches[safeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMenu(null);
    }
  };

  return (
    <div className="mq-mention-wrap">
      {open && (
        <ul className="mq-mention-menu" role="listbox">
          {matches.map((p, i) => (
            <li
              key={p._id}
              role="option"
              aria-selected={i === safeIndex}
              className={`mq-mention-item${i === safeIndex ? ' mq-mention-item--active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); select(p); }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span className="mq-mention-item-name">{p.name}</span>
              <span className="mq-mention-item-role">{p.role}</span>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="text"
        className={className}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={() => sync(value)}
        onBlur={() => setTimeout(() => setMenu(null), 120)}
      />
    </div>
  );
}
