import { LuVideo, LuCalendarClock, LuTrash2, LuExternalLink } from 'react-icons/lu';
import { meetingCopy, fmtMeetingDateTime } from '../utils/meeting';

/**
 * A scheduled meeting rendered as a centered system event inside a conversation
 * thread (support tickets & orders). Its copy is derived live from the phase —
 * "scheduled" → "starting soon" → "in progress" → "ended" — using the shared
 * ticking `now` passed by the parent, so it updates without a reload.
 *
 * Once a meeting has ended or been cancelled it carries no actions (no join,
 * reschedule, or cancel) — it's purely a record of what happened.
 */
export default function MeetingMessage({
  meeting, now, canManage = false, showCalendarLink = false,
  onReschedule, onCancel, cancelling = false,
}) {
  if (!meeting?.scheduledAt && meeting?.status !== 'cancelled') return null;

  const { phase, title, sub } = meetingCopy(meeting, now);
  const closed = phase === 'ended' || phase === 'cancelled';
  const joinable = !closed && !!meeting.meetingLink;
  const showActions = canManage && !closed;
  // Rescheduling only makes sense before the meeting starts.
  const canReschedule = phase === 'upcoming' || phase === 'soon';

  return (
    <div className="cv-event">
      <div className={`cv-event-card cv-event-card--${phase}`}>
        <span className="cv-event-icon"><LuVideo size={16} /></span>
        <span className="cv-event-title">{title}</span>
        {meeting.scheduledAt && (
          <span className="cv-event-when">
            {fmtMeetingDateTime(meeting.scheduledAt)}
            {meeting.durationMins ? ` · ${meeting.durationMins} min` : ''}
          </span>
        )}
        {sub && <span className="cv-event-sub">{sub}</span>}

        {(joinable || (showCalendarLink && !closed && meeting.htmlLink)) && (
          <span className="cv-event-links">
            {joinable && (
              <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="cv-event-join">
                <LuVideo size={13} /> Join meeting
              </a>
            )}
            {showCalendarLink && !closed && meeting.htmlLink && (
              <a href={meeting.htmlLink} target="_blank" rel="noreferrer" className="sp-meet-link">
                <LuExternalLink size={12} /> Calendar
              </a>
            )}
          </span>
        )}

        {showActions && (
          <span className="cv-event-actions">
            {canReschedule && (
              <button className="sp-linkbtn" onClick={onReschedule}>
                <LuCalendarClock size={13} /> Reschedule
              </button>
            )}
            <button className="sp-linkbtn sp-linkbtn--danger" onClick={onCancel} disabled={cancelling}>
              <LuTrash2 size={13} /> {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
