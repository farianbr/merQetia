import { useState } from 'react';
import DateTimePicker from './DateTimePicker';
import { LuX, LuCalendarDays, LuVideo, LuUsers } from 'react-icons/lu';

/**
 * Schedule or reschedule a team meeting in a channel. When scheduling, the
 * organiser picks an audience — whole departments and/or individuals (org
 * channel) or individual teammates (department channel). Google emails the
 * calendar invite to everyone selected.
 *
 * `mentionables` is the channel's people list ([{ _id, name, role }]) where a
 * `role: 'department'` entry is a department group target.
 *
 * @param {object|null} existing  meeting message being rescheduled (audience locked)
 * @param {function}    onSubmit  async ({ scheduledAt, durationMins, note, departments, individuals }) => message
 */
export default function TeamMeetingModal({ existing = null, mentionables = [], onSubmit, onScheduled, onClose }) {
  const meeting = existing?.meeting || null;
  const departments = mentionables.filter((m) => m.role === 'department');
  const people = mentionables.filter((m) => m.role !== 'department');

  const [when, setWhen] = useState(meeting?.scheduledAt ? new Date(meeting.scheduledAt).toISOString() : '');
  const [duration, setDuration] = useState(String(meeting?.durationMins || 30));
  const [note, setNote] = useState(meeting?.note || '');
  const [selDepts, setSelDepts] = useState([]);
  const [selPeople, setSelPeople] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submit = async (e) => {
    e.preventDefault();
    if (!when) { setError('Pick a date and time.'); return; }
    if (new Date(when).getTime() <= Date.now()) { setError('Pick a time in the future.'); return; }
    if (!existing && selDepts.length === 0 && selPeople.length === 0) {
      setError('Invite at least one department or person.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await onSubmit({
        scheduledAt: when,
        durationMins: Number(duration),
        note: note.trim(),
        departments: selDepts,
        individuals: selPeople,
      });
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
            <span>{existing ? 'Reschedule team meeting' : 'Schedule team meeting'}</span>
          </div>
          <button className="smm-close" onClick={onClose} aria-label="Close"><LuX size={16} /></button>
        </div>

        <p className="smm-sub">
          Creates a Google Calendar event with a Meet link and emails the invite to everyone selected.
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

          {!existing && (
            <>
              {departments.length > 0 && (
                <div className="form-group">
                  <label className="form-label"><LuUsers size={13} /> Departments</label>
                  <div className="checkbox-group">
                    {departments.map((d) => (
                      <label key={d.name} className="checkbox-label">
                        <input type="checkbox" checked={selDepts.includes(d.name)} onChange={() => toggle(selDepts, setSelDepts, d.name)} disabled={saving} />
                        {d.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{departments.length > 0 ? 'Individuals' : 'Invite teammates'}</label>
                {people.length === 0 ? (
                  <p style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>No teammates to invite.</p>
                ) : (
                  <div className="checkbox-group">
                    {people.map((p) => (
                      <label key={p._id} className="checkbox-label">
                        <input type="checkbox" checked={selPeople.includes(p._id)} onChange={() => toggle(selPeople, setSelPeople, p._id)} disabled={saving} />
                        {p.name} <span style={{ color: 'var(--text-muted)', fontSize: '.8rem' }}>· {p.role}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Agenda / notes <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <input
              type="text"
              className="input"
              placeholder="What should attendees prepare?"
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
