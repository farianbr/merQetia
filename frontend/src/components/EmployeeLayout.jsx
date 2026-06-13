import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import CommandPalette from './CommandPalette';
import { getMyAssignments } from '../api/orders';
import {
  LuLayoutDashboard, LuClipboardCheck, LuBell, LuSettings, LuLogOut, LuUser,
  LuSearch, LuArrowLeft, LuArrowRight, LuMoon, LuSun,
} from 'react-icons/lu';

function mapOrders(r) {
  return (r.data.orders || r.data).map((o) => ({
    _id: o._id,
    shortId: o._id.slice(-6).toUpperCase(),
    label: (o.services || []).map((s) => s.name).join(', ') || '—',
  }));
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const NAV_ITEMS = [
  { path: '/employee',        label: 'Dashboard', Icon: LuLayoutDashboard, exact: true },
  { path: '/employee/orders', label: 'Orders',    Icon: LuClipboardCheck },
];

const SEARCH_ITEMS = [
  { label: 'Dashboard',     path: '/employee',                Icon: LuLayoutDashboard, group: 'Pages' },
  { label: 'My Orders',     path: '/employee/orders',         Icon: LuClipboardCheck,  group: 'Pages' },
  { label: 'Profile',       path: '/employee/profile',        Icon: LuUser,            group: 'Account' },
  { label: 'Settings',      path: '/employee/settings',       Icon: LuSettings,        group: 'Account' },
  { label: 'Notifications', path: '/employee/notifications',  Icon: LuBell,            group: 'Account' },
];

function fmtNotifTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function EmployeeLayoutInner({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const bellRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setSearchOpen((v) => !v); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleBellClick = () => {
    setBellOpen((v) => {
      const next = !v;
      if (!next && unreadCount > 0) markAllRead();
      return next;
    });
    setProfileOpen(false);
  };

  const handleNotifClick = (notif) => {
    markRead(notif._id);
    setBellOpen(false);
    if (notif.type === 'message') {
      navigate(`/employee?openUpdate=${notif.orderId}`);
    } else {
      navigate('/employee/orders', { state: { orderId: notif.orderId } });
    }
  };

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'E';

  const avatarSrc = user?.avatar ? `${API_BASE}${user.avatar}` : null;

  return (
    <div className="cl-shell">
      {/* ── Sidebar ── */}
      <aside className="cl-sidebar">
        <div className="cl-sidebar-brand">
          <a href="http://merqetia.nl/" className="cl-brand-name">merQetia</a>
          <span className="cl-brand-sub">Employee</span>
        </div>

        <nav className="cl-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`cl-nav-item ${isActive(item) ? 'cl-nav-item--active' : ''}`}
            >
              <item.Icon size={17} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="cl-sidebar-footer">
          <Link
            to="/employee/profile"
            className={`cl-nav-item ${location.pathname === '/employee/profile' ? 'cl-nav-item--active' : 'cl-nav-item--muted'}`}
          >
            <LuUser size={17} />
            <span>Profile</span>
          </Link>
          <Link
            to="/employee/settings"
            className={`cl-nav-item ${location.pathname === '/employee/settings' ? 'cl-nav-item--active' : 'cl-nav-item--muted'}`}
          >
            <LuSettings size={17} />
            <span>Settings</span>
          </Link>
          <button onClick={handleLogout} className="cl-nav-item cl-nav-item--logout">
            <LuLogOut size={17} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="cl-main">
        <header className="cl-topbar">
          {/* Left: back/forward + search + dark mode */}
          <div className="cl-topbar-left">
            <button className="cl-icon-btn cl-nav-hist-btn" aria-label="Go back" onClick={() => navigate(-1)} title="Go back">
              <LuArrowLeft size={16} />
            </button>
            <button className="cl-icon-btn cl-nav-hist-btn" aria-label="Go forward" onClick={() => navigate(1)} title="Go forward">
              <LuArrowRight size={16} />
            </button>
            <button className="cl-search-trigger" onClick={() => setSearchOpen(true)} aria-label="Search">
              <LuSearch size={14} className="cl-search-trigger-icon" />
              <span className="cl-search-trigger-text">Search…</span>
              <kbd className="cl-search-kbd">Ctrl K</kbd>
            </button>
            <button
              className="cl-icon-btn cl-dark-btn"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setDarkMode((v) => !v)}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <LuSun size={16} /> : <LuMoon size={16} />}
            </button>
          </div>

          {/* Right: bell + avatar */}
          <div className="cl-topbar-right">
            <div className="cl-notif-wrap" ref={bellRef}>
              <button className="cl-icon-btn" aria-label="Notifications" onClick={handleBellClick}>
                <LuBell size={18} />
                {unreadCount > 0 && <span className="cl-notif-badge" aria-hidden="true" />}
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
                      <Link to="/employee/notifications" className="cl-notif-see-all" onClick={() => setBellOpen(false)}>
                        See all notifications →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Avatar with profile dropdown */}
            <div className="cl-profile-wrap" ref={profileRef}>
              <button
                className="cl-avatar-btn"
                onClick={() => { setProfileOpen((v) => !v); setBellOpen(false); }}
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt={user?.name} className="cl-avatar cl-avatar--img" />
                ) : (
                  <div className="cl-avatar">{initials}</div>
                )}
              </button>
              {profileOpen && (
                <div className="cl-profile-dropdown">
                  <div className="cl-profile-dd-head">
                    <div className="cl-profile-dd-avatar">
                      {avatarSrc ? (
                        <img src={avatarSrc} alt={user?.name} className="cl-profile-dd-img" />
                      ) : (
                        <div className="cl-profile-dd-initials">{initials}</div>
                      )}
                    </div>
                    <div className="cl-profile-dd-info">
                      <span className="cl-profile-dd-name">{user?.name}</span>
                      <span className="cl-profile-dd-email">{user?.email}</span>
                    </div>
                  </div>
                  <div className="cl-profile-dd-sep" />
                  <Link to="/employee/profile" className="cl-profile-dd-item" onClick={() => setProfileOpen(false)}>
                    <LuUser size={15} /> Profile
                  </Link>
                  <Link to="/employee/settings" className="cl-profile-dd-item" onClick={() => setProfileOpen(false)}>
                    <LuSettings size={15} /> Settings
                  </Link>
                  <button className="cl-profile-dd-item cl-profile-dd-item--logout" onClick={handleLogout}>
                    <LuLogOut size={15} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="cl-content">{children}</div>
      </div>

      {searchOpen && (
        <CommandPalette
          searchItems={SEARCH_ITEMS}
          onOrderSearch={(id) => navigate('/employee/orders', { state: { orderId: id } })}
          fetchSuggestions={() => getMyAssignments().then(mapOrders)}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

export default function EmployeeLayout({ children }) {
  return (
    <NotificationProvider>
      <EmployeeLayoutInner>{children}</EmployeeLayoutInner>
    </NotificationProvider>
  );
}
