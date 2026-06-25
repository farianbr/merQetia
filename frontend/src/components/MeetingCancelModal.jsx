import { LuX, LuCalendarClock, LuTrash2, LuTriangleAlert } from 'react-icons/lu';

function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/**
 * Confirm cancelling a scheduled meeting. Nudges the user to reschedule instead
 * of outright cancelling — rescheduling keeps the client engaged rather than
 * dropping the meeting entirely.
 */
export default function MeetingCancelModal({ meeting, onClose, onReschedule, onConfirm, cancelling = false }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal smm" onClick={(e) => e.stopPropagation()}>
        <div className="smm-head">
          <div className="smm-head-title">
            <LuTriangleAlert size={17} />
            <span>Cancel this meeting?</span>
          </div>
          <button className="smm-close" onClick={onClose} aria-label="Close" disabled={cancelling}>
            <LuX size={16} />
          </button>
        </div>

        <div className="mcm-body">
          <p className="smm-sub" style={{ padding: 0 }}>
            The meeting on <strong>{fmtDateTime(meeting?.scheduledAt)}</strong> will be removed from the
            calendar and the client will be notified.
          </p>
          <p className="mcm-suggest">
            Need a different time instead? <strong>Reschedule</strong> to keep the meeting and just move it.
          </p>
        </div>

        <div className="mcm-actions">
          <button className="btn-primary" onClick={onReschedule} disabled={cancelling}>
            <LuCalendarClock size={14} /> Reschedule instead
          </button>
          <div className="mcm-actions-row">
            <button className="btn-secondary" onClick={onClose} disabled={cancelling}>Keep meeting</button>
            <button className="mcm-cancel-btn" onClick={onConfirm} disabled={cancelling}>
              <LuTrash2 size={14} /> {cancelling ? 'Cancelling…' : 'Cancel meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
