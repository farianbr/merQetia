import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import {
  LuLayoutDashboard, LuWrench, LuShoppingBag, LuFileText,
  LuSettings, LuLogOut, LuBell, LuPlus,
} from 'react-icons/lu';

const DashIcon     = () => <LuLayoutDashboard size={17} />;
const ServicesIcon = () => <LuWrench         size={17} />;
const OrdersIcon   = () => <LuShoppingBag    size={17} />;
const InvoicesIcon = () => <LuFileText       size={17} />;
const SettingsIcon = () => <LuSettings       size={17} />;
const LogoutIcon   = () => <LuLogOut         size={17} />;
const BellIcon     = () => <LuBell           size={18} />;
const PlusIcon     = () => <LuPlus           size={15} />;

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', Icon: DashIcon },
  { path: '/services',  label: 'Services',  Icon: ServicesIcon },
  { path: '/orders',    label: 'Orders',    Icon: OrdersIcon },
  { path: '/invoices',  label: 'Invoices',  Icon: InvoicesIcon },
];

function fmtNotifTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Inner layout — uses NotificationContext ───────────────────────────────────
function ClientLayoutInner({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleNotifClick = (notif) => {
    markRead(notif._id);
    setBellOpen(false);
    navigate('/orders', { state: { selectOrderId: notif.orderId } });
  };

  const handleBellClick = () => {
    setBellOpen((v) => {
      const next = !v;
      // Mark all read when closing the dropdown
      if (!next && unreadCount > 0) markAllRead();
      return next;
    });
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="cl-shell">
      {/* ── Sidebar ── */}
      <aside className="cl-sidebar">
        <div className="cl-sidebar-brand">
          <a href="http://merqetia.nl/" className="cl-brand-name">merQetia</a>
        </div>

        <nav className="cl-nav">
          {NAV_ITEMS.map((item) => {
            const NavIcon = item.Icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`cl-nav-item ${location.pathname === item.path ? 'cl-nav-item--active' : ''}`}
              >
                <NavIcon />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="cl-sidebar-footer">
          <Link
            to="/settings"
            className={`cl-nav-item ${location.pathname === '/settings' ? 'cl-nav-item--active' : 'cl-nav-item--muted'}`}
          >
            <SettingsIcon />
            Settings
          </Link>
          <button onClick={handleLogout} className="cl-nav-item cl-nav-item--logout">
            <LogoutIcon />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main: topbar + content ── */}
      <div className="cl-main">
        <header className="cl-topbar">
          <div className="cl-topbar-right">
            {/* Bell with notification dropdown */}
            <div className="cl-notif-wrap" ref={bellRef}>
              <button className="cl-icon-btn" aria-label="Notifications" onClick={handleBellClick}>
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="cl-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              {bellOpen && (
                <div className="cl-notif-dropdown">
                  <div className="cl-notif-header">
                    <span className="cl-notif-title">Notifications</span>
                    {unreadCount > 0 && (
                      <button className="cl-notif-mark-all" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="cl-notif-list">
                    {notifications.length === 0 ? (
                      <p className="cl-notif-empty">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 3).map((n) => (
                        <div
                          key={n._id}
                          className={`cl-notif-item ${n.read ? '' : 'cl-notif-item--unread'}`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className="cl-notif-item-top">
                            <span className="cl-notif-item-title">{n.title}</span>
                            <span className="cl-notif-item-time">{fmtNotifTime(n.createdAt)}</span>
                          </div>
                          <span className="cl-notif-item-body">{n.type === 'status' ? n.body : (n.typeLabel || n.body)}</span>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="cl-notif-footer">
                      <Link
                        to="/notifications"
                        className="cl-notif-see-all"
                        onClick={() => setBellOpen(false)}
                      >
                        See all notifications →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link to="/services" className="cl-create-btn">
              <PlusIcon />
              Create Order
            </Link>
            <div className="cl-avatar" title={user?.name}>{initials}</div>
          </div>
        </header>

        <div className="cl-content">{children}</div>
      </div>
    </div>
  );
}

// ── Exported wrapper — provides NotificationContext ───────────────────────────
export default function ClientLayout({ children }) {
  return (
    <NotificationProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </NotificationProvider>
  );
}
