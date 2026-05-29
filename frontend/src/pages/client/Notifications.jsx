import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { LuActivity, LuMessageSquare, LuBell } from 'react-icons/lu';

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
  status:  <LuActivity     size={16} />,
  message: <LuMessageSquare size={16} />,
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
            <LuBell size={40} color="#d1d5db" />
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
