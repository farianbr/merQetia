import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { LuActivity, LuMessageSquare, LuBell, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

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

export default function AdminNotifications() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(notifications.length / PAGE_SIZE));
  // Derive the in-range page so a shrinking list never strands us on a missing page.
  const safePage = Math.min(page, totalPages);

  const handleClick = (n) => {
    markRead(n._id);
    if (n.type === 'message') {
      navigate(`/admin?openUpdate=${n.orderId}`);
    } else {
      navigate(`/admin/orders/${n.orderId}`);
    }
  };

  const start = (safePage - 1) * PAGE_SIZE;
  const visible = notifications.slice(start, start + PAGE_SIZE);

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
                  <span className="nf-item-desc">{n.body}</span>
                </div>
                <span className="nf-item-time">{fmtTime(n.createdAt)}</span>
                {!n.read && <span className="nf-item-dot" />}
              </div>
            ))}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="nf-pagination">
          <button
            className="nf-page-btn"
            disabled={safePage === 1}
            onClick={() => setPage(Math.max(1, safePage - 1))}
          >
            <LuChevronLeft size={16} /> Prev
          </button>
          <span className="nf-page-info">Page {safePage} of {totalPages}</span>
          <button
            className="nf-page-btn"
            disabled={safePage === totalPages}
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
          >
            Next <LuChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
