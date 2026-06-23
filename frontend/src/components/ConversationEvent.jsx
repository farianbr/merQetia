import { LuRefreshCw, LuPackageCheck } from 'react-icons/lu';

/**
 * A lifecycle event rendered inline in an order conversation. It marks an
 * important moment in the work and is kept permanently so the full revision
 * history stays visible. Styled as a quiet, centered card (~half width) rather
 * than a chat bubble, and always attributed by the actor's name.
 *
 *   change-request   — the client asked for changes (their note is shown).
 *   review-submitted — the team submitted the work for the client's review.
 *
 * A review submission is a pending hand-off: once the client responds it
 * resolves, so its state flips from "awaiting" to either "changes requested"
 * (a later change-request exists) or "approved" (the order completed).
 */
function reviewOutcome(messages, index, orderStatus) {
  const respondedWithChanges = (messages || [])
    .slice(index + 1)
    .some((m) => m.kind === 'change-request');
  if (respondedWithChanges) return 'changes';
  if (orderStatus === 'completed') return 'approved';
  return 'pending';
}

const OUTCOME_LABEL = {
  changes: 'Changes requested',
  approved: 'Approved',
};

export default function ConversationEvent({ msg, index = 0, messages = [], orderStatus }) {
  const { kind, text, createdAt, sender } = msg;
  const isChange = kind === 'change-request';

  const name = sender?.name || (isChange ? 'The client' : 'The team');
  const when = createdAt
    ? new Date(createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  const outcome = isChange ? null : reviewOutcome(messages, index, orderStatus);
  const iconMod = isChange ? 'change' : outcome; // pending | changes | approved
  const Icon = isChange ? LuRefreshCw : LuPackageCheck;
  const title = isChange ? `${name} requested changes` : `${name} submitted for review`;

  return (
    <div className="chat-event">
      <span className={`chat-event-icon chat-event-icon--${iconMod}`}>
        <Icon size={15} strokeWidth={2.5} />
      </span>
      <p className="chat-event-title">{title}</p>
      {when && <span className="chat-event-time">{when}</span>}

      {/* Change requests carry the client's note; review submissions don't. */}
      {isChange && text && <p className="chat-event-note">{text}</p>}

      {/* Review submissions resolve once the client responds. */}
      {!isChange && OUTCOME_LABEL[outcome] && (
        <span className={`chat-event-status chat-event-status--${outcome}`}>
          {OUTCOME_LABEL[outcome]}
        </span>
      )}
    </div>
  );
}
