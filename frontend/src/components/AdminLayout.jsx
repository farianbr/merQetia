import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrders } from '../api/orders';

// ── Icons ─────────────────────────────────────────────────────────────────────
const DashIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const OrdersIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 01-8 0"/>
  </svg>
);
const ServicesIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
  </svg>
);
const InvoicesIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const ReportsIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);
const ExpensesIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);
const EmployeesIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
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
  { path: '/admin',            label: 'Dashboard', Icon: DashIcon,       exact: true },
  { path: '/admin/orders',     label: 'Orders',    Icon: OrdersIcon,     badge: true },
  { path: '/admin/services',   label: 'Services',  Icon: ServicesIcon },
  { path: '/admin/invoices',   label: 'Invoices',  Icon: InvoicesIcon },
  { path: '/admin/reports',    label: 'Reports',   Icon: ReportsIcon },
  { path: '/admin/expenses',   label: 'Expenses',  Icon: ExpensesIcon },
  { path: '/admin/employees',  label: 'Employees', Icon: EmployeesIcon },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [pendingCount, setPendingCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Load pending order count
  useEffect(() => {
    const load = () =>
      getOrders()
        .then((r) => {
          const list = r.data.orders || r.data;
          setPendingCount(list.filter((o) => o.status === 'placed').length);
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
                {item.badge && pendingCount > 0 && (
                  <span className="cl-nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
                )}
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
