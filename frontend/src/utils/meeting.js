import { useEffect, useState } from 'react';

/**
 * Shared helpers for rendering scheduled meetings (support tickets & orders).
 * A meeting moves through phases as real time passes; the UI re-derives these
 * live from a ticking clock so it updates without a page reload.
 */

export const MEETING_MS = { soonWindow: 10 * 60 * 1000 }; // "starting soon" lead time

const startMs = (m) => (m?.scheduledAt ? new Date(m.scheduledAt).getTime() : 0);
const endMs = (m) => startMs(m) + (m?.durationMins || 0) * 60000;

/**
 * Current phase of a meeting given "now":
 *   cancelled | upcoming | soon | ongoing | ended
 */
export function meetingPhase(meeting, now = Date.now()) {
  if (!meeting?.scheduledAt) return 'ended';
  if (meeting.status === 'cancelled') return 'cancelled';
  const start = startMs(meeting);
  const end = endMs(meeting);
  if (now >= end) return 'ended';
  if (now >= start) return 'ongoing';
  if (start - now <= MEETING_MS.soonWindow) return 'soon';
  return 'upcoming';
}

// A meeting is "live" (worth surfacing in the header / blocking a new booking)
// while it is scheduled and hasn't ended yet.
export const isMeetingLive = (m, now = Date.now()) =>
  m?.status !== 'cancelled' && !!m?.scheduledAt && endMs(m) > now;

/** The soonest still-live meeting in a list (for the conversation header). */
export function activeMeeting(meetings = [], now = Date.now()) {
  return (meetings || [])
    .filter((m) => isMeetingLive(m, now))
    .sort((a, b) => startMs(a) - startMs(b))[0] || null;
}

/** Whether a new meeting can be scheduled (none currently live). */
export const canScheduleMeeting = (meetings = [], now = Date.now()) =>
  !meetings?.some((m) => isMeetingLive(m, now));

// Coarse, human-friendly relative duration ("3 days", "2 hours", "15 minutes").
function humanizeDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'less than a minute';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

export const timeUntil = (iso, now = Date.now()) => humanizeDuration(new Date(iso).getTime() - now);
export const timeSince = (iso, now = Date.now()) => humanizeDuration(now - new Date(iso).getTime());

/**
 * Title + subtitle copy for a meeting card, derived from its live phase.
 */
export function meetingCopy(meeting, now = Date.now()) {
  const phase = meetingPhase(meeting, now);
  switch (phase) {
    case 'cancelled':
      return { phase, title: 'Meeting cancelled', sub: '' };
    case 'soon':
      return { phase, title: 'Starting soon', sub: `Starts in ${timeUntil(meeting.scheduledAt, now)}` };
    case 'ongoing':
      return { phase, title: 'Meeting in progress', sub: `Started ${timeSince(meeting.scheduledAt, now)} ago` };
    case 'ended':
      return { phase, title: 'Meeting ended', sub: meeting.scheduledAt ? `Ended ${timeSince(endMs(meeting), now)} ago` : '' };
    default:
      return { phase, title: 'Meeting scheduled', sub: `In ${timeUntil(meeting.scheduledAt, now)}` };
  }
}

/** Short countdown for the conversation header pill. */
export function meetingHeaderLabel(meeting, now = Date.now()) {
  const phase = meetingPhase(meeting, now);
  if (phase === 'ongoing') return 'Meeting in progress';
  if (phase === 'soon') return `Meeting starts in ${timeUntil(meeting.scheduledAt, now)}`;
  return `Meeting in ${timeUntil(meeting.scheduledAt, now)}`;
}

export function fmtMeetingDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/**
 * A clock that ticks on an interval so dependent UI updates live. Default 15s
 * is plenty for minute-level countdowns and keeps re-renders cheap.
 */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
