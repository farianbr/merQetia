import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import {
  LuLayoutDashboard, LuShoppingBag, LuWrench, LuFileText,
  LuChartBar, LuDollarSign, LuUsers, LuSettings, LuLogOut, LuBell,
} from 'react-icons/lu';

// ── Icons ─────────────────────────────────────────────────────────────────────
const DashIcon      = () => <LuLayoutDashboard size={17} />;
const OrdersIcon    = () => <LuShoppingBag     size={17} />;
const ServicesIcon  = () => <LuWrench          size={17} />;
const InvoicesIcon  = () => <LuFileText        size={17} />;
const ReportsIcon   = () => <LuChartBar        size={17} />;
const ExpensesIcon  = () => <LuDollarSign      size={17} />;
const EmployeesIcon = () => <LuUsers           size={17} />;
const SettingsIcon  = () => <LuSettings        size={17} />;
const LogoutIcon    = () => <LuLogOut          size={17} />;
const BellIcon      = () => <LuBell            size={18} />;

function fmtNotifTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const NAV_ITEMS = [
  { path: '/admin',            label: 'Dashboard', Icon: DashIcon,       exact: true },
  { path: '/admin/orders',     label: 'Orders',    Icon: OrdersIcon },
  { path: '/admin/services',   label: 'Services',  Icon: ServicesIcon },
  { path: '/admin/invoices',   label: 'Invoices',  Icon: InvoicesIcon },
  { path: '/admin/reports',    label: 'Reports',   Icon: ReportsIcon },
  { path: '/admin/expenses',   label: 'Expenses',  Icon: ExpensesIcon },
  { path: '/admin/employees',  label: 'Employees', Icon: EmployeesIcon },
];

function AdminLayoutInner({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const userMenuRef = useRef(null);
  const bellRef = useRef(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))
        setUserMenuOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target))
        setBellOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleBellClick = () => {
    setBellOpen((v) => {
      const next = !v;
      if (!next && unreadCount > 0) markAllRead();
      return next;
    });
  };

  const handleNotifClick = (notif) => {
    markRead(notif._id);
    setBellOpen(false);
    if (notif.type === 'message') {
      navigate(`/admin?openUpdate=${notif.orderId}`);
    } else {
      navigate(`/admin/orders/${notif.orderId}`);
    }
  };

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  return (
    <div className="cl-shell">
      {/* ── Sidebar ── */}
      <aside className="cl-sidebar">
        <div className="cl-sidebar-brand">
          <a href="http://merqetia.nl/" className="cl-brand-name">merQetia</a>
          <span className="cl-brand-sub">Admin</span>
        </div>

        <nav className="cl-nav">
          {NAV_ITEMS.map((item) => {
            const NavIcon = item.Icon;
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`cl-nav-item ${active ? 'cl-nav-item--active' : ''}`}
              >
                <NavIcon />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="cl-sidebar-footer">
          <Link
            to="/admin/settings"
            className={`cl-nav-item ${location.pathname === '/admin/settings' ? 'cl-nav-item--active' : 'cl-nav-item--muted'}`}
          >
            <SettingsIcon />
            <span>Settings</span>
          </Link>
          <button onClick={handleLogout} className="cl-nav-item cl-nav-item--logout">
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
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
                      <button className="cl-notif-mark-all" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="cl-notif-list">
                    {notifications.length === 0 ? (
                      <p className="cl-notif-empty">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div
                          key={n._id}
                          className={`cl-notif-item ${n.read ? '' : 'cl-notif-item--unread'}`}
                          onClick={() => handleNotifClick(n)}
                        >
                          <div className="cl-notif-item-top">
                            <span className="cl-notif-item-title">{n.title}</span>
                            <span className="cl-notif-item-time">{fmtNotifTime(n.createdAt)}</span>
                          </div>
                          <span className="cl-notif-item-body">{n.body}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="cl-user-menu-wrap" ref={userMenuRef}>
              <button
                className="cl-avatar"
                title={user?.name}
                onClick={() => setUserMenuOpen((v) => !v)}
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div className="cl-user-menu">
                  <div className="cl-user-menu-info">
                    <span className="cl-user-menu-name">{user?.name}</span>
                    <span className="cl-user-menu-role">Administrator</span>
                  </div>
                  <button className="cl-user-menu-item cl-user-menu-item--logout" onClick={handleLogout}>
                    <LogoutIcon /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="cl-content">{children}</div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }) {
  return (
    <NotificationProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </NotificationProvider>
  );
}
