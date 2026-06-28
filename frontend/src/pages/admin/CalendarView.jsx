import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCalendarEvents } from "../../api/calendar";
import {
  LuChevronLeft,
  LuChevronRight,
  LuVideo,
  LuX,
  LuExternalLink,
  LuClock,
  LuUser,
} from "react-icons/lu";

/* Event type → label + accent color. Meetings (orders, support, team) share a
   single color; their source is shown in the detail popover. */
const EVENT_TYPES = {
  "order-placed": { label: "Order placed", color: "#1f8cb4" },
  "order-deadline": { label: "Deadline", color: "#ef4444" },
  meeting: { label: "Meeting", color: "#8b5cf6" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dayKey = (d) =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* The 42-cell (6-week) grid covering a month, Sunday-first like Google Calendar. */
function buildGrid(viewDate) {
  const first = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

/* ─── Event detail popover ─────────────────────────────────────────── */
function EventDetail({ event, pos, onClose }) {
  const cfg = EVENT_TYPES[event.type] || { label: event.type, color: "#9ca3af" };
  const m = event.meta || {};
  return (
    <>
      <div className="mq-cal-pop-overlay" onClick={onClose} />
      <div
        className="mq-cal-pop"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mq-cal-pop-head">
          <span className="mq-cal-pop-dot" style={{ background: cfg.color }} />
          <span className="mq-cal-pop-type">{cfg.label}</span>
          <button className="mq-cal-pop-close" onClick={onClose} aria-label="Close">
            <LuX size={15} />
          </button>
        </div>
        <h4 className="mq-cal-pop-title">{event.title}</h4>
        <div className="mq-cal-pop-meta">
          <span className="mq-cal-pop-row">
            <LuClock size={13} />
            {event.allDay
              ? new Date(event.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : `${new Date(event.date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })} · ${fmtTime(event.date)}${
                  m.durationMins ? ` (${m.durationMins} min)` : ""
                }`}
          </span>
          {m.client && (
            <span className="mq-cal-pop-row">
              <LuUser size={13} /> {m.client}
            </span>
          )}
          {m.employee && (
            <span className="mq-cal-pop-row">
              <LuUser size={13} /> Assigned: {m.employee}
            </span>
          )}
          {m.channel && (
            <span className="mq-cal-pop-row">
              <LuUser size={13} /> {m.channel}
              {m.organizer ? ` · ${m.organizer}` : ""}
            </span>
          )}
          {m.subject && (
            <span className="mq-cal-pop-row mq-cal-pop-note">{m.subject}</span>
          )}
          {m.note && (
            <span className="mq-cal-pop-row mq-cal-pop-note">{m.note}</span>
          )}
        </div>
        <div className="mq-cal-pop-actions">
          {m.meetingLink && (
            <a
              href={m.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mq-cal-pop-btn mq-cal-pop-btn--join"
            >
              <LuVideo size={14} /> Join meeting
            </a>
          )}
          {event.link && (
            <Link to={event.link} className="mq-cal-pop-btn">
              <LuExternalLink size={14} /> Open
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Day "more events" popover ────────────────────────────────────── */
function DayList({ date, events, pos, onClose, onPick }) {
  return (
    <>
      <div className="mq-cal-pop-overlay" onClick={onClose} />
      <div
        className="mq-cal-pop mq-cal-daypop"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mq-cal-pop-head">
          <span className="mq-cal-daypop-date">
            {date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </span>
          <button className="mq-cal-pop-close" onClick={onClose} aria-label="Close">
            <LuX size={15} />
          </button>
        </div>
        <div className="mq-cal-daypop-list">
          {events.map((ev) => {
            const cfg = EVENT_TYPES[ev.type] || { color: "#9ca3af" };
            return (
              <button
                key={ev.id}
                className="mq-cal-chip mq-cal-chip--full"
                onClick={(e) => onPick(ev, e)}
              >
                <span className="mq-cal-chip-dot" style={{ background: cfg.color }} />
                {!ev.allDay && (
                  <span className="mq-cal-chip-time">{fmtTime(ev.date)}</span>
                )}
                <span className="mq-cal-chip-title">{ev.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

const MAX_CHIPS = 3;

export default function CalendarView() {
  const [viewDate, setViewDate] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventPop, setEventPop] = useState(null); // { event, pos }
  const [dayPop, setDayPop] = useState(null); // { date, events, pos }

  const today = useMemo(() => new Date(), []);
  const cells = useMemo(() => buildGrid(viewDate), [viewDate]);

  useEffect(() => {
    const gridStart = cells[0];
    const gridEnd = new Date(cells[41]);
    gridEnd.setHours(23, 59, 59, 999);
    setLoading(true);
    getCalendarEvents(gridStart.toISOString(), gridEnd.toISOString())
      .then((r) => setEvents(r.data.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [cells]);

  // Group events by day for O(1) cell lookup.
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const ev of events) {
      const k = dayKey(new Date(ev.date));
      (map[k] ||= []).push(ev);
    }
    return map;
  }, [events]);

  const openEvent = (ev, e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 300, r.left);
    const top = Math.min(window.innerHeight - 280, r.bottom + 6);
    setDayPop(null);
    setEventPop({ event: ev, pos: { left, top } });
  };

  const openDay = (date, dayEvents, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const left = Math.min(window.innerWidth - 280, r.left);
    const top = Math.min(window.innerHeight - 320, r.top);
    setEventPop(null);
    setDayPop({ date, events: dayEvents, pos: { left, top } });
  };

  const goPrev = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () =>
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () =>
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));

  return (
    <div className="mq-cal">
      <div className="mq-cal-toolbar">
        <div className="mq-cal-nav">
          <button className="mq-cal-today" onClick={goToday}>
            Today
          </button>
          <button className="mq-cal-arrow" onClick={goPrev} aria-label="Previous month">
            <LuChevronLeft size={18} />
          </button>
          <button className="mq-cal-arrow" onClick={goNext} aria-label="Next month">
            <LuChevronRight size={18} />
          </button>
          <h2 className="mq-cal-month">
            {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
          </h2>
        </div>
        <div className="mq-cal-legend">
          {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
            <span key={key} className="mq-cal-legend-item">
              <span className="mq-cal-chip-dot" style={{ background: cfg.color }} />
              {cfg.label}
            </span>
          ))}
          {loading && <span className="mq-cal-loading">Loading…</span>}
        </div>
      </div>

      <div className="mq-cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="mq-cal-weekday">
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const inMonth = date.getMonth() === viewDate.getMonth();
          const isToday = sameDay(date, today);
          const dayEvents = eventsByDay[dayKey(date)] || [];
          const shown = dayEvents.slice(0, MAX_CHIPS);
          const overflow = dayEvents.length - shown.length;
          return (
            <div
              key={date.toISOString()}
              className={`mq-cal-cell${inMonth ? "" : " mq-cal-cell--muted"}${
                isToday ? " mq-cal-cell--today" : ""
              }`}
            >
              <div className="mq-cal-cell-head">
                <span
                  className={`mq-cal-daynum${isToday ? " mq-cal-daynum--today" : ""}`}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="mq-cal-cell-events">
                {shown.map((ev) => {
                  const cfg = EVENT_TYPES[ev.type] || { color: "#9ca3af" };
                  return (
                    <button
                      key={ev.id}
                      className="mq-cal-chip"
                      onClick={(e) => openEvent(ev, e)}
                      title={ev.title}
                    >
                      <span
                        className="mq-cal-chip-dot"
                        style={{ background: cfg.color }}
                      />
                      {!ev.allDay && (
                        <span className="mq-cal-chip-time">{fmtTime(ev.date)}</span>
                      )}
                      <span className="mq-cal-chip-title">{ev.title}</span>
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    className="mq-cal-more"
                    onClick={(e) => openDay(date, dayEvents, e)}
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {eventPop && (
        <EventDetail
          event={eventPop.event}
          pos={eventPop.pos}
          onClose={() => setEventPop(null)}
        />
      )}
      {dayPop && (
        <DayList
          date={dayPop.date}
          events={dayPop.events}
          pos={dayPop.pos}
          onClose={() => setDayPop(null)}
          onPick={openEvent}
        />
      )}
    </div>
  );
}
