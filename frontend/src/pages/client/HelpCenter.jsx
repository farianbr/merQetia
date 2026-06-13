import { useState } from 'react';
import { sendSupportMessage } from '../../api/support';
import { LuMail, LuCalendarDays, LuCircleCheck, LuSendHorizontal } from 'react-icons/lu';

const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM',
  '2:00 PM', '3:00 PM', '4:00 PM',
];

function ContactForm() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setLoading(true);
    setError('');
    try {
      await sendSupportMessage({ type: 'message', subject, message });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="hc-success">
        <LuCircleCheck size={40} color="#10b981" />
        <p className="hc-success-title">Message sent!</p>
        <p className="hc-success-sub">We'll get back to you within 24 hours.</p>
        <button className="btn-secondary" onClick={() => { setDone(false); setSubject(''); setMessage(''); }}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="hc-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Subject</label>
        <input
          type="text"
          className="input hc-input"
          placeholder="What do you need help with?"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          disabled={loading}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label">Message</label>
        <textarea
          className="input hc-input hc-textarea"
          placeholder="Describe your question or issue in detail…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          disabled={loading}
          required
        />
        <span className="hc-char-hint">{message.length} / 2000</span>
      </div>
      {error && <p className="page-error">{error}</p>}
      <button
        type="submit"
        className="btn-primary hc-submit-btn"
        disabled={loading || !subject.trim() || !message.trim()}
      >
        {loading ? 'Sending…' : (
          <><LuSendHorizontal size={15} /> Send Message</>
        )}
      </button>
    </form>
  );
}

function MeetingForm() {
  const [subject, setSubject] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !preferredDate || !preferredTime) return;
    setLoading(true);
    setError('');
    try {
      await sendSupportMessage({
        type: 'meeting',
        subject,
        message: message || '(No additional notes)',
        preferredDate,
        preferredTime,
      });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="hc-success">
        <LuCircleCheck size={40} color="#10b981" />
        <p className="hc-success-title">Meeting request sent!</p>
        <p className="hc-success-sub">
          We'll confirm your slot for{' '}
          <strong>{preferredDate} at {preferredTime}</strong> within 24 hours.
        </p>
        <button
          className="btn-secondary"
          onClick={() => { setDone(false); setSubject(''); setPreferredDate(''); setPreferredTime(''); setMessage(''); }}
        >
          Schedule another meeting
        </button>
      </div>
    );
  }

  return (
    <form className="hc-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Meeting topic</label>
        <input
          type="text"
          className="input hc-input"
          placeholder="e.g. Project kick-off, Review campaign results…"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          disabled={loading}
          required
        />
      </div>
      <div className="hc-row">
        <div className="form-group">
          <label className="form-label">Preferred date</label>
          <input
            type="date"
            className="input hc-input"
            value={preferredDate}
            min={today}
            onChange={(e) => setPreferredDate(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Preferred time</label>
          <select
            className="input hc-input"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">Select a slot…</option>
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Additional notes <span className="hc-optional">(optional)</span></label>
        <textarea
          className="input hc-input hc-textarea hc-textarea--sm"
          placeholder="Anything you'd like us to prepare or know beforehand…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          disabled={loading}
        />
      </div>
      {error && <p className="page-error">{error}</p>}
      <button
        type="submit"
        className="btn-primary hc-submit-btn"
        disabled={loading || !subject.trim() || !preferredDate || !preferredTime}
      >
        {loading ? 'Sending…' : (
          <><LuCalendarDays size={15} /> Request Meeting</>
        )}
      </button>
    </form>
  );
}

export default function HelpCenter() {
  return (
    <div className="page">
      <div className="hc-hero">
        <h1>Help Center</h1>
        <p className="subtitle">
          Have a question or want to schedule a call? We typically respond within 24 hours.
        </p>
      </div>

      <div className="hc-grid">
        <div className="card hc-card">
          <div className="hc-card-head">
            <span className="hc-card-icon hc-card-icon--mail">
              <LuMail size={20} />
            </span>
            <div>
              <h2 className="hc-card-title">Send a Message</h2>
              <p className="hc-card-sub">Describe your issue and we'll reply by email.</p>
            </div>
          </div>
          <ContactForm />
        </div>

        <div className="card hc-card">
          <div className="hc-card-head">
            <span className="hc-card-icon hc-card-icon--cal">
              <LuCalendarDays size={20} />
            </span>
            <div>
              <h2 className="hc-card-title">Schedule a Meeting</h2>
              <p className="hc-card-sub">Pick a time and we'll confirm your slot.</p>
            </div>
          </div>
          <MeetingForm />
        </div>
      </div>
    </div>
  );
}
