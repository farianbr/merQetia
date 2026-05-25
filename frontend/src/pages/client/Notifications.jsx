import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

const PAGE_SIZE = 10;

function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_ICON = {
  status: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  message: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
};

export default function ClientNotifications() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef(null);

  // IntersectionObserver — load more when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, notifications.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [notifications.length]);

  const handleClick = (n) => {
    markRead(n._id);
    navigate('/orders', { state: { selectOrderId: n.orderId } });
  };

  const visible = notifications.slice(0, visibleCount);
  const hasMore = visibleCount < notifications.length;

  return (
    <div className="nf-page">
      <div className="nf-header">
        <div>
          <h1>Notifications</h1>
          <p className="nf-sub">
            {notifications.length === 0
              ? 'No notifications yet.'
              : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn-secondary" onClick={markAllRead}>Mark all as read</button>
        )}
      </div>

      <div className="nf-list">
        {notifications.length === 0 ? (
          <div className="nf-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <p>You&apos;re all caught up!</p>
          </div>
        ) : (
          <>
            {visible.map((n) => (
              <div
                key={n._id}
                className={`nf-item ${n.read ? '' : 'nf-item--unread'}`}
                onClick={() => handleClick(n)}
              >
                <div className={`nf-item-icon nf-item-icon--${n.type}`}>
                  {TYPE_ICON[n.type]}
                </div>
                <div className="nf-item-body">
                  <span className="nf-item-title">{n.title}</span>
                  <span className="nf-item-desc">{n.typeLabel} — {n.body}</span>
                </div>
                <span className="nf-item-time">{fmtTime(n.createdAt)}</span>
                {!n.read && <span className="nf-item-dot" />}
              </div>
            ))}
            {hasMore && <div ref={sentinelRef} className="nf-sentinel" />}
          </>
        )}
      </div>
    </div>
  );
}
