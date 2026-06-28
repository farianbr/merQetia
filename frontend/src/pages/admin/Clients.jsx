import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getClients } from '../../api/admin';
import { LuSearch, LuUser, LuShoppingBag, LuExternalLink, LuUsers, LuActivity } from 'react-icons/lu';

import { mediaUrl } from '../../utils/media';

function initials(name) {
  return (name || '?').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getClients()
      .then((r) => setClients(r.data.clients || []))
      .catch(() => setError('Failed to load clients.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter((c) => c.activeOrders > 0).length,
    orders: clients.reduce((s, c) => s + (c.totalOrders || 0), 0),
  }), [clients]);

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h1>Clients</h1>
          <p className="subtitle">All registered clients and their order activity.</p>
        </div>
        <div className="ac-search-wrap">
          <LuSearch size={14} className="ac-search-icon" />
          <input
            type="text"
            className="ac-search-input"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="page-error">{error}</p>}

      {!loading && clients.length > 0 && (
        <div className="ac-summary">
          <div className="card ac-summary-card">
            <span className="ac-summary-icon" style={{ color: '#1f8cb4' }}><LuUsers size={18} /></span>
            <div>
              <span className="ac-summary-value">{stats.total}</span>
              <span className="ac-summary-label">Total clients</span>
            </div>
          </div>
          <div className="card ac-summary-card">
            <span className="ac-summary-icon" style={{ color: '#10b981' }}><LuActivity size={18} /></span>
            <div>
              <span className="ac-summary-value">{stats.active}</span>
              <span className="ac-summary-label">With active orders</span>
            </div>
          </div>
          <div className="card ac-summary-card">
            <span className="ac-summary-icon" style={{ color: '#f59e0b' }}><LuShoppingBag size={18} /></span>
            <div>
              <span className="ac-summary-value">{stats.orders}</span>
              <span className="ac-summary-label">Total orders</span>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="ac-empty">
          {search ? `No clients match "${search}".` : 'No clients registered yet.'}
        </div>
      ) : (
        <div className="ac-grid">
          {filtered.map((c) => {
            const avatarSrc = mediaUrl(c.avatar);
            return (
              <div key={c._id} className="ac-card">
                <div className="ac-card-top">
                  <div className="ac-avatar">
                    {avatarSrc ? (
                      <img src={avatarSrc} alt={c.name} className="ac-avatar-img" />
                    ) : (
                      <span>{initials(c.name)}</span>
                    )}
                  </div>
                  <div className="ac-card-info">
                    <span className="ac-card-name">{c.name}</span>
                    <span className="ac-card-email">{c.email}</span>
                    <span className="ac-card-since">
                      Client since {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <div className="ac-card-stats">
                  <div className="ac-stat">
                    <LuShoppingBag size={13} />
                    <span>{c.totalOrders} order{c.totalOrders !== 1 ? 's' : ''}</span>
                  </div>
                  {c.activeOrders > 0 && (
                    <div className="ac-stat ac-stat--active">
                      <span>{c.activeOrders} active</span>
                    </div>
                  )}
                </div>
                <Link to={`/admin/clients/${c._id}`} className="ac-view-btn">
                  <LuUser size={14} />
                  View Profile
                  <LuExternalLink size={12} className="ac-view-ext" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
