import { useEffect, useState } from 'react';
import { LuCalendarDays, LuChevronLeft, LuChevronRight, LuCheck, LuX } from 'react-icons/lu';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const sameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// 24h hour → { h12, ampm }
const to12 = (h) => ({ h12: ((h + 11) % 12) + 1, ampm: h < 12 ? 'AM' : 'PM' });
const to24 = (h12, ampm) => (ampm === 'PM' ? (h12 % 12) + 12 : h12 % 12);

// First valid slot at or after `from`, rounded up to the next 5 minutes.
const nextSlot = (from) => {
  const d = new Date(from.getTime() + 5 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
};

/**
 * A self-contained date + time picker rendered in a centered modal (so it never
 * runs off-screen) with an explicit Done button. Controlled via `value` (ISO
 * string) / `onChange`. Past days — and, on the current day, past times — are
 * disabled so only future slots can be chosen.
 */
export default function DateTimePicker({ value, onChange, min, disabled }) {
  const minDate = min ? new Date(min) : new Date();
  const initial = value ? new Date(value) : null;
  const seed = initial || nextSlot(minDate);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfDay(seed)); // displayed month
  const [draftDay, setDraftDay] = useState(() => (initial ? startOfDay(initial) : null));
  const [h12, setH12] = useState(() => to12(seed.getHours()).h12);
  const [ampm, setAmpm] = useState(() => to12(seed.getHours()).ampm);
  const [minute, setMinute] = useState(() => Math.floor(seed.getMinutes() / 5) * 5);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const composed = () => {
    if (!draftDay) return null;
    const d = new Date(draftDay);
    d.setHours(to24(h12, ampm), minute, 0, 0);
    return d;
  };

  const commit = () => {
    const d = composed();
    if (!d) { setError('Pick a day.'); return; }
    if (d.getTime() <= minDate.getTime()) { setError('Pick a time in the future.'); return; }
    setError('');
    onChange?.(d.toISOString());
    setOpen(false);
  };

  // Build the month grid (leading blanks + days).
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
  const minDay = startOfDay(minDate);

  // On the current day, anything at/earlier than "now" is in the past.
  const isToday = draftDay && sameDay(draftDay, minDate);
  const minH = minDate.getHours();
  const minM = minDate.getMinutes();
  const cur24 = to24(h12, ampm);
  const ampmDisabled = (ap) => isToday && ap === 'AM' && minH >= 12;
  const hourDisabled = (h) => isToday && to24(h, ampm) < minH;
  const minuteDisabled = (m) => isToday && (cur24 < minH || (cur24 === minH && m <= minM));

  const display = value
    ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : 'Select date & time';

  const prevDisabled = startOfDay(new Date(year, month, 1)) <= startOfDay(new Date(minDay.getFullYear(), minDay.getMonth(), 1));

  return (
    <div className="dtp">
      <button
        type="button"
        className={`dtp-trigger ${value ? '' : 'dtp-trigger--empty'}`}
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
      >
        <LuCalendarDays size={15} />
        <span>{display}</span>
      </button>

      {open && (
        <div className="modal-overlay dtp-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>
          <div className="dtp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dtp-modal-head">
              <span className="dtp-modal-title"><LuCalendarDays size={15} /> Pick date &amp; time</span>
              <button type="button" className="smm-close" onClick={() => setOpen(false)} aria-label="Close"><LuX size={16} /></button>
            </div>

            <div className="dtp-cal-head">
              <button type="button" className="dtp-nav" onClick={() => setView(new Date(year, month - 1, 1))} disabled={prevDisabled} aria-label="Previous month">
                <LuChevronLeft size={16} />
              </button>
              <span className="dtp-month">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              <button type="button" className="dtp-nav" onClick={() => setView(new Date(year, month + 1, 1))} aria-label="Next month">
                <LuChevronRight size={16} />
              </button>
            </div>

            <div className="dtp-grid dtp-grid--wd">
              {WEEKDAYS.map((w) => <span key={w} className="dtp-wd">{w}</span>)}
            </div>
            <div className="dtp-grid">
              {cells.map((d, i) => {
                if (!d) return <span key={`b${i}`} className="dtp-day dtp-day--blank" />;
                const isPast = startOfDay(d) < minDay;
                const selected = sameDay(d, draftDay);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    className={`dtp-day ${selected ? 'dtp-day--sel' : ''}`}
                    disabled={isPast}
                    onClick={() => { setDraftDay(startOfDay(d)); setError(''); }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="dtp-time">
              <span className="dtp-time-label">Time</span>
              <div className="dtp-time-selects">
                <select className="field dtp-sel" value={h12} onChange={(e) => setH12(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h} disabled={hourDisabled(h)}>{h}</option>
                  ))}
                </select>
                <span className="dtp-colon">:</span>
                <select className="field dtp-sel" value={minute} onChange={(e) => setMinute(Number(e.target.value))}>
                  {MINUTES.map((m) => (
                    <option key={m} value={m} disabled={minuteDisabled(m)}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <select className="field dtp-sel" value={ampm} onChange={(e) => setAmpm(e.target.value)}>
                  <option value="AM" disabled={ampmDisabled('AM')}>AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            {error && <p className="dtp-error">{error}</p>}

            <div className="dtp-actions">
              <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary btn-sm" onClick={commit}>
                <LuCheck size={14} /> Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
