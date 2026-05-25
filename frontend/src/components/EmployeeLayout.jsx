import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMyAssignments } from '../api/orders';

// ── Icons ─────────────────────────────────────────────────────────────────────
const DashIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const AssignmentsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);
const LogoutIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

const NAV_ITEMS = [
  { path: '/employee',         label: 'Dashboard', Icon: DashIcon,        exact: true },
  { path: '/employee/orders',  label: 'Orders',    Icon: AssignmentsIcon, badge: true },
];

export default function EmployeeLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [pendingCount, setPendingCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Load pending assignment count
  useEffect(() => {
    const load = () =>
      getMyAssignments()
        .then((r) => {
          const list = r.data.orders || r.data;
          setPendingCount(list.filter((o) => o.status === 'assigned').length);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))
        setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'E';

  return (
    <div className="cl-shell">
      {/* ── Sidebar ── */}
      <aside className="cl-sidebar">
        <div className="cl-sidebar-brand">
          <a href="http://merqetia.nl/" className="cl-brand-name">merQetia</a>
          <span className="cl-brand-sub">Employee</span>
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
                {item.badge && pendingCount > 0 && (
                  <span className="cl-nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="cl-sidebar-footer">
          <Link
            to="/employee/settings"
            className={`cl-nav-item ${location.pathname === '/employee/settings' ? 'cl-nav-item--active' : 'cl-nav-item--muted'}`}
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
                    <span className="cl-user-menu-role">Employee</span>
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
