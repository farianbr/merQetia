const STATUS_COLORS = {
  placed: '#f59e0b',
  assigned: '#3b82f6',
  accepted: '#8b5cf6',
  rejected: '#ef4444',
  completed: '#10b981',
};

const STATUS_LABEL = {
  placed: 'Pending',
  assigned: 'Assigned',
  accepted: 'Processing',
  rejected: 'Rejected',
  completed: 'Completed',
};

const NORMAL_STEPS = ['placed', 'assigned', 'accepted', 'completed'];

export default function OrderTimeline({ status }) {
  const isRejected = status === 'rejected';
  const steps = isRejected ? ['placed', 'assigned', 'rejected'] : NORMAL_STEPS;
  const activeIndex = steps.indexOf(status);

  return (
    <div className="co-timeline">
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const shouldPulse = active && step !== 'completed' && step !== 'rejected';
        const color =
          active || done
            ? STATUS_COLORS[isRejected && active ? 'rejected' : step]
            : undefined;

        return (
          <div className="co-tl-step" key={step}>
            {i > 0 && (
              <div
                className={`co-tl-line ${done || active ? 'co-tl-line--done' : ''}`}
                style={done || active ? { background: color } : undefined}
              />
            )}
            <div className="co-tl-node-wrap">
              <div
                className={[
                  'co-tl-node',
                  done ? 'co-tl-node--done' : '',
                  active ? 'co-tl-node--active' : '',
                  shouldPulse ? 'co-tl-node--pulse' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={
                  shouldPulse
                    ? { '--pulse-color': color }
                    : active || done
                    ? { background: color, borderColor: color }
                    : undefined
                }
              >
                {done ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="2,6 5,9 10,3" />
                  </svg>
                ) : active && isRejected && step === 'rejected' ? (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="3" y1="3" x2="9" y2="9" />
                    <line x1="9" y1="3" x2="3" y2="9" />
                  </svg>
                ) : null}
              </div>
              <span
                className={`co-tl-label ${active ? 'co-tl-label--active' : ''}`}
                style={active ? { color } : undefined}
              >
                {STATUS_LABEL[step]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
