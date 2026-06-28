import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import CommandPalette from './CommandPalette';
import BrandLogo from './BrandLogo';
import { getOrders } from '../api/orders';
import { getMyTickets } from '../api/support';
import {
  LuLayoutDashboard, LuWrench, LuShoppingBag, LuFileText,
  LuLogOut, LuBell, LuPlus, LuUser, LuSettings, LuLifeBuoy,
  LuSearch, LuArrowLeft, LuArrowRight, LuMoon, LuSun, LuMenu,
} from 'react-icons/lu';

import { mediaUrl } from '../utils/media';

function mapOrders(r) {
  return (r.data.orders || r.data).map((o) => ({
    _id: o._id,
    shortId: o._id.slice(-6).toUpperCase(),
    label: (o.services || []).map((s) => s.name).join(', ') || '—',
  }));
}

function mapTickets(r) {
  return (r.data.requests || []).map((t) => ({
    _id: t._id, ticketId: t.ticketId, subject: t.subject,
  }));
}

// ── Nav items (main) ────────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', Icon: LuLayoutDashboard },
  { path: '/services',  label: 'Services',  Icon: LuWrench },
  { path: '/orders',    label: 'Orders',    Icon: LuShoppingBag },
  { path: '/invoices',  label: 'Invoices',  Icon: LuFileText },
];

// ── Command palette search items ────────────────────────────────────
const SEARCH_ITEMS = [
  { label: 'Dashboard',      path: '/dashboard',     Icon: LuLayoutDashboard, group: 'Pages' },
  { label: 'Services',       path: '/services',      Icon: LuWrench,          group: 'Pages' },
  { label: 'My Orders',      path: '/orders',        Icon: LuShoppingBag,     group: 'Pages' },
  { label: 'Invoices',       path: '/invoices',      Icon: LuFileText,        group: 'Pages' },
  { label: 'Help Center',    path: '/help',          Icon: LuLifeBuoy,        group: 'Pages' },
  { label: 'My Profile',     path: '/profile',       Icon: LuUser,            group: 'Account' },
  { label: 'Settings',       path: '/settings',      Icon: LuSettings,        group: 'Account' },
  { label: 'Notifications',  path: '/notifications', Icon: LuBell,            group: 'Account' },
];

function fmtNotifTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpenPath, setNavOpenPath] = useState(null);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  const navOpen = navOpenPath === location.pathname;

  const bellRef = useRef(null);
  const profileRef = useRef(null);

  // Apply dark mode to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleNotifClick = (notif) => {
    markRead(notif._id);
    setBellOpen(false);
    if (notif.link) return navigate(notif.link);
    navigate('/orders', { state: { selectOrderId: notif.orderId } });
  };

  const handleBellClick = () => {
    setBellOpen((v) => {
      const next = !v;
      if (!next && unreadCount > 0) markAllRead();
      return next;
    });
    setProfileOpen(false);
  };

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const avatarSrc = mediaUrl(user?.avatar);

  return (
    <div className="cl-shell">
      {/* Mobile drawer overlay */}
      {navOpen && <div className="cl-nav-overlay" onClick={() => setNavOpenPath(null)} />}

      {/* ── Sidebar ── */}
      <aside className={`cl-sidebar ${navOpen ? 'cl-sidebar--open' : ''}`}>
        <div className="cl-sidebar-brand">
          <a href="http://merqetia.nl/" className="cl-brand-name"><BrandLogo /></a>
        </div>

        <nav className="cl-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`cl-nav-item ${location.pathname === item.path ? 'cl-nav-item--active' : ''}`}
            >
              <item.Icon size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="cl-sidebar-footer">
          <Link
            to="/help"
            className={`cl-nav-item ${location.pathname === '/help' ? 'cl-nav-item--active' : 'cl-nav-item--muted'}`}
          >
            <LuLifeBuoy size={17} />
            Help Center
          </Link>
        </div>
      </aside>

      {/* ── Main: topbar + content ── */}
      <div className="cl-main">
        <header className="cl-topbar">
          {/* Left: back/forward + search + dark mode */}
          <div className="cl-topbar-left">
            <button className="cl-icon-btn cl-hamburger" aria-label="Open menu" onClick={() => setNavOpenPath(location.pathname)} title="Menu">
              <LuMenu size={18} />
            </button>
            <button
              className="cl-icon-btn cl-nav-hist-btn"
              aria-label="Go back"
              onClick={() => navigate(-1)}
              title="Go back"
            >
              <LuArrowLeft size={16} />
            </button>
            <button
              className="cl-icon-btn cl-nav-hist-btn"
              aria-label="Go forward"
              onClick={() => navigate(1)}
              title="Go forward"
            >
              <LuArrowRight size={16} />
            </button>

            <button
              className="cl-search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
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

          {/* Right: bell + create order + avatar */}
          <div className="cl-topbar-right">
            {/* Bell */}
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
                          <span className="cl-notif-item-body">
                            {n.type === 'status' ? n.body : (n.typeLabel || n.body)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="cl-notif-footer">
                      <Link to="/notifications" className="cl-notif-see-all" onClick={() => setBellOpen(false)}>
                        See all notifications →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link to="/services" className="cl-create-btn">
              <LuPlus size={15} />
              <span className="cl-create-btn-text">Create Order</span>
            </Link>

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
                  <Link
                    to="/profile"
                    className="cl-profile-dd-item"
                    onClick={() => setProfileOpen(false)}
                  >
                    <LuUser size={15} />
                    My Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="cl-profile-dd-item"
                    onClick={() => setProfileOpen(false)}
                  >
                    <LuSettings size={15} />
                    Settings
                  </Link>
                  <button
                    className="cl-profile-dd-item cl-profile-dd-item--logout"
                    onClick={handleLogout}
                  >
                    <LuLogOut size={15} />
                    Log out
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
          onOrderSearch={(id) => navigate('/orders', { state: { selectOrderId: id } })}
          fetchSuggestions={() => getOrders().then(mapOrders)}
          fetchTicketSuggestions={() => getMyTickets().then(mapTickets)}
          onTicketSearch={(id) => navigate(`/help?ticket=${id}`)}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

// ── Exported wrapper ─────────────────────────────────────────────────────────
export default function ClientLayout({ children }) {
  return (
    <NotificationProvider>
      <ClientLayoutInner>{children}</ClientLayoutInner>
    </NotificationProvider>
  );
}
