import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';

/* Every notification event is an independent toggle so users get the most
 * granular control. Keys must match backend User.NOTIFICATION_KEYS. */
const TYPES_BY_ROLE = {
  admin: [
    { key: 'newOrder', label: 'New order placed', desc: 'A client places a new order awaiting assignment.' },
    { key: 'orderAccepted', label: 'Employee accepted an order', desc: 'An assigned employee accepts an order.' },
    { key: 'orderRejected', label: 'Employee declined an order', desc: 'An assigned employee declines an order.' },
    { key: 'orderSubmitted', label: 'Order submitted for review', desc: 'An employee submits work for client review.' },
    { key: 'changesRequested', label: 'Client requested changes', desc: 'A client requests changes on submitted work.' },
    { key: 'orderCompleted', label: 'Order completed', desc: 'An order is confirmed and completed.' },
    { key: 'mentions', label: 'You were mentioned', desc: 'Someone @mentions you in an internal update or team chat.' },
    { key: 'teamUpdates', label: 'Team updates', desc: 'An employee posts an internal update on an order.' },
    { key: 'teamMessage', label: 'Team chat messages', desc: 'A new message is posted in a team channel you belong to.' },
    { key: 'teamMeeting', label: 'Team meetings', desc: 'A team meeting is scheduled, rescheduled, or cancelled.' },
    { key: 'newSupportTicket', label: 'New support ticket', desc: 'A client opens a support ticket.' },
  ],
  employee: [
    { key: 'newAssignment', label: 'New order assigned to you', desc: 'An admin assigns a new order to you.' },
    { key: 'reassigned', label: 'Order reassigned away', desc: 'An order is moved to another employee.' },
    { key: 'changesRequested', label: 'Client requested changes', desc: 'A client asks for revisions on your work.' },
    { key: 'orderCompleted', label: 'Order completed', desc: 'A client confirms and completes your order.' },
    { key: 'deliveryUpdated', label: 'Delivery date updated', desc: 'An admin changes the delivery date.' },
    { key: 'messages', label: 'New messages', desc: 'A client sends a message on your order.' },
    { key: 'mentions', label: 'You were mentioned', desc: 'Someone @mentions you in an internal update or team chat.' },
    { key: 'teamUpdates', label: 'Team updates', desc: 'An admin posts an internal update on your order.' },
    { key: 'teamMessage', label: 'Team chat messages', desc: 'A new message is posted in a team channel you belong to.' },
    { key: 'teamMeeting', label: 'Team meetings', desc: 'A team meeting is scheduled, rescheduled, or cancelled.' },
    { key: 'newSupportTicket', label: 'New support ticket', desc: 'A client opens a support ticket.' },
  ],
  client: [
    { key: 'orderAssigned', label: 'Order assigned', desc: 'Your order is assigned to an employee.' },
    { key: 'orderInProgress', label: 'Order in progress', desc: 'Your order is accepted and underway.' },
    { key: 'orderReview', label: 'Ready for your review', desc: 'Your order is ready for you to review.' },
    { key: 'orderDeclined', label: 'Order declined', desc: 'Your order is declined by an employee.' },
    { key: 'orderCompleted', label: 'Order completed', desc: 'Your order is marked complete.' },
    { key: 'deliveryUpdated', label: 'Delivery date updated', desc: 'The delivery date for your order changes.' },
    { key: 'statusReset', label: 'Order status changed', desc: 'An admin updates your order status.' },
    { key: 'messages', label: 'New messages', desc: 'Your employee sends you a message.' },
    { key: 'supportUpdate', label: 'Support updates', desc: 'Your support ticket is accepted, scheduled, or answered.' },
  ],
};

/* Defaults mirror the backend model: in-app on for all; email on only for the
 * two pre-existing transactional emails. */
const EMAIL_DEFAULT_ON = new Set(['newOrder', 'newAssignment']);

function valueFor(prefs, channel, key) {
  const stored = prefs?.[channel]?.[key];
  if (typeof stored === 'boolean') return stored;
  return channel === 'inApp' ? true : EMAIL_DEFAULT_ON.has(key);
}

export default function NotificationPrefs() {
  const { user, setSession } = useAuth();
  const types = TYPES_BY_ROLE[user?.role] || TYPES_BY_ROLE.client;

  const [prefs, setPrefs] = useState(() => {
    const src = user?.notificationPrefs;
    const next = { email: {}, inApp: {} };
    types.forEach(({ key }) => {
      next.inApp[key] = valueFor(src, 'inApp', key);
      next.email[key] = valueFor(src, 'email', key);
    });
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const toggle = (channel, key) => {
    setPrefs((p) => ({ ...p, [channel]: { ...p[channel], [key]: !p[channel][key] } }));
    setMsg('');
    setErr('');
  };

  const setAll = (channel, value) => {
    setPrefs((p) => {
      const next = { ...p[channel] };
      types.forEach(({ key }) => { next[key] = value; });
      return { ...p, [channel]: next };
    });
    setMsg('');
    setErr('');
  };

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    setMsg('');
    try {
      const r = await updateProfile({ notificationPrefs: prefs });
      const updatedUser = r.data.user;
      const token = localStorage.getItem('token');
      if (token) setSession(token, updatedUser);
      else localStorage.setItem('user', JSON.stringify(updatedUser));
      setMsg('Notification preferences saved.');
    } catch (e) {
      setErr(e.response?.data?.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="np-table">
        <div className="np-row np-row--head">
          <span className="np-cat">Notification</span>
          <button type="button" className="np-col-toggle" title="Toggle all" onClick={() => setAll('inApp', !types.every((t) => prefs.inApp[t.key]))}>In-App</button>
          <button type="button" className="np-col-toggle" title="Toggle all" onClick={() => setAll('email', !types.every((t) => prefs.email[t.key]))}>Email</button>
        </div>
        {types.map(({ key, label, desc }) => (
          <div className="np-row" key={key}>
            <span className="np-cat">
              <span className="np-cat-label">{label}</span>
              <span className="np-cat-desc">{desc}</span>
            </span>
            <span className="np-ch">
              <label className="np-switch">
                <input type="checkbox" checked={!!prefs.inApp[key]} onChange={() => toggle('inApp', key)} />
                <span className="np-slider" />
              </label>
            </span>
            <span className="np-ch">
              <label className="np-switch">
                <input type="checkbox" checked={!!prefs.email[key]} onChange={() => toggle('email', key)} />
                <span className="np-slider" />
              </label>
            </span>
          </div>
        ))}
      </div>

      {err && <p className="error-msg">{err}</p>}
      {msg && <p className="st-msg st-msg--ok">{msg}</p>}
      <button className="btn-primary set-save" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save Preferences'}
      </button>
    </>
  );
}
