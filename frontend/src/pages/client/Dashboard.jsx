import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getOrders } from '../../api/orders';
import { getInvoices } from '../../api/invoices';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import {
  LuArrowRight, LuArrowUpRight, LuLayers, LuClipboardCheck, LuWallet,
  LuCircleCheck, LuWrench, LuFileText, LuLifeBuoy, LuPencilRuler, LuBell,
} from 'react-icons/lu';

const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

const ACTIVE_STATUSES = new Set(['placed', 'assigned', 'accepted', 'review']);

// Status → label / colour / position along the delivery journey
const STATUS_COLORS = {
  placed:   '#f59e0b',
  assigned: '#3b82f6',
  accepted: '#33a8d1',
  review:   '#8b5cf6',
  overdue:  '#dc2626',
};
const STATUS_LABEL = {
  placed:   'Placed',
  assigned: 'Assigned',
  accepted: 'In Progress',
  review:   'Needs Review',
  overdue:  'Overdue',
};
const PHASE_ORDER = ['placed', 'assigned', 'accepted', 'review', 'completed'];

function getDisplayStatus(order) {
  if (order.status === 'accepted' && order.deliveryDate && new Date(order.deliveryDate) < new Date()) {
    return 'overdue';
  }
  return order.status;
}

function progressPct(status) {
  const base = status === 'overdue' ? 'accepted' : status;
  const idx = PHASE_ORDER.indexOf(base);
  if (idx < 0) return 8;
  return Math.round(((idx + 1) / PHASE_ORDER.length) * 100);
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ Icon, label, value, sub, tone }) {
  return (
    <div className={`cd-stat cd-stat--${tone}`}>
      <div className="cd-stat-icon"><Icon size={18} /></div>
      <div className="cd-stat-body">
        <span className="cd-stat-value">{value}</span>
        <span className="cd-stat-label">{label}</span>
      </div>
      {sub && <span className="cd-stat-sub">{sub}</span>}
    </div>
  );
}

// ─── Active project row ─────────────────────────────────────────────────────
function ProjectRow({ order }) {
  const name = (order.services || []).map((s) => s.name).join(', ') || 'Order';
  const ds = getDisplayStatus(order);
  const color = STATUS_COLORS[ds] || '#6b7280';
  const label = STATUS_LABEL[ds] || ds;
  const pct = progressPct(ds);

  return (
    <Link to="/orders" state={{ selectOrderId: order._id }} className="cd-project">
      <div className="cd-project-head">
        <div className="cd-project-id">#{order._id.slice(-6).toUpperCase()}</div>
        <span className="cd-project-badge" style={{ background: color + '1a', color }}>{label}</span>
      </div>
      <span className="cd-project-name">{name}</span>
      <div className="cd-project-track">
        <div className="cd-project-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="cd-project-foot">
        <span className="cd-project-assignee">
          {order.assignedEmployee?.name ? `with ${order.assignedEmployee.name}` : 'Awaiting assignment'}
        </span>
        {order.deliveryDate && (
          <span className="cd-project-due">Due {fmtDate(order.deliveryDate)}</span>
        )}
      </div>
    </Link>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const socket = useSocket();

  useEffect(() => {
    Promise.all([getOrders(), getInvoices()])
      .then(([oRes, iRes]) => {
        setOrders(oRes.data.orders || oRes.data || []);
        setInvoices(iRes.data.invoices || iRes.data || []);
      })
      .catch(() => setError('Failed to load your dashboard'))
      .finally(() => setLoading(false));
  }, []);

  // Live order updates
  useEffect(() => {
    if (!socket) return;
    const handle = ({ order }) => {
      if (!order?._id) return;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o._id === order._id);
        if (idx === -1) return [order, ...prev];
        const next = [...prev];
        next[idx] = order;
        return next;
      });
    };
    socket.on('order:updated', handle);
    socket.on('order:created', handle);
    return () => {
      socket.off('order:updated', handle);
      socket.off('order:created', handle);
    };
  }, [socket]);

  if (loading) return <div className="loading">Loading workspace…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const reviewOrders = orders.filter((o) => o.status === 'review');
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid');
  const outstanding = unpaidInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const attentionCount = reviewOrders.length + unpaidInvoices.length;

  return (
    <div className="cd-page">
      {/* Hero greeting */}
      <header className="cd-hero">
        <div className="cd-hero-text">
          <span className="cd-hero-eyebrow">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <h1 className="cd-hero-title">{greeting()}, {firstName}</h1>
          <p className="cd-hero-sub">
            {attentionCount > 0
              ? `You have ${attentionCount} item${attentionCount !== 1 ? 's' : ''} that need your attention.`
              : 'Everything is on track. Here’s your workspace at a glance.'}
          </p>
        </div>
        <Link to="/services" className="cd-hero-cta">
          <LuPencilRuler size={16} />
          Start a new project
        </Link>
      </header>

      {/* Needs your attention — surfaced right under the greeting */}
      {attentionCount > 0 && (
        <section className="cd-attention">
          <div className="cd-attention-head">
            <span className="cd-attention-heading">
              <LuBell size={15} />
              Needs your attention
            </span>
            <span className="cd-attention-count">{attentionCount}</span>
          </div>
          <div className="cd-attention-list">
            {reviewOrders.map((o) => (
              <Link key={o._id} to="/orders" state={{ selectOrderId: o._id }} className="cd-attention-item">
                <span className="cd-attention-dot" style={{ background: STATUS_COLORS.review }} />
                <div className="cd-attention-body">
                  <span className="cd-attention-title">Review ready</span>
                  <span className="cd-attention-meta">
                    {(o.services || []).map((s) => s.name).join(', ') || `#${o._id.slice(-6).toUpperCase()}`}
                  </span>
                </div>
                <span className="cd-attention-action">Review <LuArrowUpRight size={14} /></span>
              </Link>
            ))}
            {unpaidInvoices.map((inv) => (
              <Link key={inv._id} to="/invoices" className="cd-attention-item">
                <span className="cd-attention-dot" style={{ background: STATUS_COLORS.placed }} />
                <div className="cd-attention-body">
                  <span className="cd-attention-title">Payment due · {eur.format(inv.amount)}</span>
                  <span className="cd-attention-meta">Invoice {inv.invoiceNumber}</span>
                </div>
                <span className="cd-attention-action">Pay <LuArrowUpRight size={14} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* KPI row */}
      <section className="cd-stats">
        <StatCard tone="cyan"   Icon={LuLayers}         label="Active projects"   value={activeOrders.length} />
        <StatCard tone="violet" Icon={LuClipboardCheck} label="Awaiting your review" value={reviewOrders.length} />
        <StatCard tone="amber"  Icon={LuWallet}         label="Outstanding"
          value={eur.format(outstanding)}
          sub={unpaidInvoices.length > 0 ? `${unpaidInvoices.length} invoice${unpaidInvoices.length !== 1 ? 's' : ''}` : 'All settled'} />
        <StatCard tone="green"  Icon={LuCircleCheck}    label="Completed"         value={completedCount} />
      </section>

      {/* Main grid */}
      <div className="cd-grid">
        {/* Active projects */}
        <section className="cd-panel cd-panel--projects">
          <div className="cd-panel-head">
            <h2 className="cd-panel-title">Active projects</h2>
            <Link to="/orders" className="cd-panel-link">View all <LuArrowRight size={14} /></Link>
          </div>
          {activeOrders.length === 0 ? (
            <div className="cd-empty">
              <LuLayers size={26} strokeWidth={1.5} />
              <p>No active projects right now.</p>
              <Link to="/services" className="cd-empty-cta">Browse services <LuArrowRight size={14} /></Link>
            </div>
          ) : (
            <div className="cd-project-list">
              {activeOrders.map((o) => <ProjectRow key={o._id} order={o} />)}
            </div>
          )}
        </section>

        {/* Right rail */}
        <div className="cd-rail">
          {/* Quick actions */}
          <section className="cd-panel cd-quick">
            <div className="cd-panel-head">
              <h2 className="cd-panel-title">Quick actions</h2>
            </div>
            <div className="cd-quick-list">
              <Link to="/services" className="cd-quick-item">
                <span className="cd-quick-icon"><LuWrench size={16} /></span>
                Browse services
              </Link>
              <Link to="/invoices" className="cd-quick-item">
                <span className="cd-quick-icon"><LuFileText size={16} /></span>
                View invoices
              </Link>
              <Link to="/help" className="cd-quick-item">
                <span className="cd-quick-icon"><LuLifeBuoy size={16} /></span>
                Help center
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
