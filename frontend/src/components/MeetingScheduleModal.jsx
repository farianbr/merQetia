import { useState } from 'react';
import DateTimePicker from './DateTimePicker';
import { LuX, LuCalendarDays, LuVideo } from 'react-icons/lu';

/**
 * Schedule or reschedule a video meeting. Generic over support tickets and
 * orders — the parent supplies `onSubmit`, which performs the request and
 * returns the updated parent record (or throws to surface an error).
 *
 * @param {object|null} existing    meeting being rescheduled (prefills the form)
 * @param {string}      inviteeLabel who gets the calendar invite (name/email)
 * @param {function}    onSubmit    async ({ scheduledAt, durationMins, note }) => updated
 * @param {function}    onScheduled called with the updated parent on success
 */
export default function MeetingScheduleModal({ existing = null, inviteeLabel, onSubmit, onScheduled, onClose }) {
  const [when, setWhen] = useState(existing?.scheduledAt ? new Date(existing.scheduledAt).toISOString() : '');
  const [duration, setDuration] = useState(String(existing?.durationMins || 30));
  const [note, setNote] = useState(existing?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!when) { setError('Pick a date and time.'); return; }
    if (new Date(when).getTime() <= Date.now()) { setError('Pick a time in the future.'); return; }
    setSaving(true);
    setError('');
    try {
      const updated = await onSubmit({ scheduledAt: when, durationMins: Number(duration), note: note.trim() });
      onScheduled?.(updated);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule the meeting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal smm" onClick={(e) => e.stopPropagation()}>
        <div className="smm-head">
          <div className="smm-head-title">
            <LuVideo size={17} />
            <span>{existing ? 'Reschedule meeting' : 'Schedule meeting'}</span>
          </div>
          <button className="smm-close" onClick={onClose} aria-label="Close"><LuX size={16} /></button>
        </div>

        <p className="smm-sub">
          Creates a Google Calendar event with a Meet link and emails the invite to{' '}
          <strong>{inviteeLabel}</strong>.
        </p>

        <form className="smm-form" onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Date &amp; time</label>
            <DateTimePicker value={when} onChange={setWhen} disabled={saving} />
          </div>

          <div className="form-group">
            <label className="form-label">Duration</label>
            <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={saving}>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Agenda / notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <input
              type="text"
              className="input"
              placeholder="What should the invitee prepare?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              disabled={saving}
            />
          </div>

          {error && <p className="page-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !when}>
              <LuCalendarDays size={14} /> {saving ? 'Saving…' : (existing ? 'Reschedule & Notify' : 'Schedule & Invite')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
