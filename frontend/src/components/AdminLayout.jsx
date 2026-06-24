import { useEffect, useRef, useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import CommandPalette from './CommandPalette';
import BrandLogo from './BrandLogo';
import { getOrders } from '../api/orders';
import { getEmployees, getClients } from '../api/admin';
import {
  LuLayoutDashboard, LuShoppingBag, LuWrench, LuFileText,
  LuChartBar, LuDollarSign, LuUsers, LuUserCheck, LuSettings, LuLogOut, LuBell,
  LuSearch, LuArrowLeft, LuArrowRight, LuMoon, LuSun, LuMenu, LuLifeBuoy,
} from 'react-icons/lu';

function mapOrders(r) {
  return (r.data.orders || r.data).map((o) => ({
    _id: o._id,
    shortId: o._id.slice(-6).toUpperCase(),
    label: (o.services || []).map((s) => s.name).join(', ') || o.type || '—',
  }));
}

async function fetchPeople() {
  const [empRes, clientRes] = await Promise.all([getEmployees(), getClients()]);
  const emps = (empRes.data.employees || []).map((e) => ({ ...e, role: 'employee' }));
  const cls = (clientRes.data.clients || []).map((c) => ({ ...c, role: 'client' }));
  return [...emps, ...cls];
}

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const NAV_ITEMS = [
  { path: '/admin',            label: 'Dashboard', Icon: LuLayoutDashboard, exact: true },
  { path: '/admin/orders',     label: 'Orders',    Icon: LuShoppingBag },
  { path: '/admin/services',   label: 'Services',  Icon: LuWrench },
  { path: '/admin/invoices',   label: 'Invoices',  Icon: LuFileText },
  { path: '/admin/reports',    label: 'Reports',   Icon: LuChartBar },
  { path: '/admin/expenses',   label: 'Expenses',  Icon: LuDollarSign },
  { path: '/admin/employees',  label: 'Team',      Icon: LuUsers },
  { path: '/admin/clients',    label: 'Clients',   Icon: LuUserCheck },
];

const SEARCH_ITEMS = [
  { label: 'Dashboard',     path: '/admin',                   Icon: LuLayoutDashboard, group: 'Pages' },
  { label: 'Orders',        path: '/admin/orders',            Icon: LuShoppingBag,     group: 'Pages' },
  { label: 'Services',      path: '/admin/services',          Icon: LuWrench,          group: 'Pages' },
  { label: 'Invoices',      path: '/admin/invoices',          Icon: LuFileText,        group: 'Pages' },
  { label: 'Reports',       path: '/admin/reports',           Icon: LuChartBar,        group: 'Pages' },
  { label: 'Expenses',      path: '/admin/expenses',          Icon: LuDollarSign,      group: 'Pages' },
  { label: 'Team',          path: '/admin/employees',         Icon: LuUsers,           group: 'Pages' },
  { label: 'Clients',       path: '/admin/clients',           Icon: LuUserCheck,       group: 'Pages' },
  { label: 'Support Center', path: '/admin/support',          Icon: LuLifeBuoy,        group: 'Pages' },
  { label: 'Settings',      path: '/admin/settings',          Icon: LuSettings,        group: 'Account' },
  { label: 'Notifications', path: '/admin/notifications',     Icon: LuBell,            group: 'Account' },
];

function fmtNotifTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function AdminLayoutInner({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();

  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpenPath, setNavOpenPath] = useState(null);
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

  const navOpen = navOpenPath === location.pathname;

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

  const avatarSrc = user?.avatar ? `${API_BASE}${user.avatar}` : null;

  // Memoize to avoid re-computing on every render
  const navItems = useMemo(() => NAV_ITEMS, []);

  return (
    <div className="cl-shell">
      {/* Mobile drawer overlay */}
      {navOpen && <div className="cl-nav-overlay" onClick={() => setNavOpenPath(null)} />}

      {/* ── Sidebar ── */}
      <aside className={`cl-sidebar ${navOpen ? 'cl-sidebar--open' : ''}`}>
        <div className="cl-sidebar-brand">
          <a href="http://merqetia.nl/" className="cl-brand-name"><BrandLogo /></a>
          <span className="cl-brand-sub">Admin</span>
        </div>

        <nav className="cl-nav">
          {navItems.map((item) => (
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
            to="/admin/support"
            className={`cl-nav-item ${location.pathname.startsWith('/admin/support') ? 'cl-nav-item--active' : ''}`}
          >
            <LuLifeBuoy size={17} />
            <span>Support Center</span>
          </Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="cl-main">
        <header className="cl-topbar">
          {/* Left: back/forward + search + dark mode */}
          <div className="cl-topbar-left">
            <button className="cl-icon-btn cl-hamburger" aria-label="Open menu" onClick={() => setNavOpenPath(location.pathname)} title="Menu">
              <LuMenu size={18} />
            </button>
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
                  {notifications.length > 0 && (
                    <div className="cl-notif-footer">
                      <Link to="/admin/notifications" className="cl-notif-see-all" onClick={() => setBellOpen(false)}>
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
                  <Link to="/admin/settings" className="cl-profile-dd-item" onClick={() => setProfileOpen(false)}>
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
          onOrderSearch={(id) => navigate(`/admin/orders/${id}`)}
          fetchSuggestions={() => getOrders().then(mapOrders)}
          fetchPeopleSuggestions={fetchPeople}
          onClose={() => setSearchOpen(false)}
        />
      )}
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
