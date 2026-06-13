import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuSearch, LuShoppingBag, LuUser, LuBriefcase, LuChevronRight } from 'react-icons/lu';

export default function CommandPalette({ searchItems, onOrderSearch, fetchSuggestions, fetchPeopleSuggestions, onClose }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [orderSuggestions, setOrderSuggestions] = useState(() => fetchSuggestions ? null : []);
  const [peopleSuggestions, setPeopleSuggestions] = useState(() => fetchPeopleSuggestions ? null : []);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const fetchRef = useRef(fetchSuggestions);
  const fetchPeopleRef = useRef(fetchPeopleSuggestions);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!fetchRef.current) return;
    fetchRef.current()
      .then((items) => setOrderSuggestions(items))
      .catch(() => setOrderSuggestions([]));
  }, []);

  useEffect(() => {
    if (!fetchPeopleRef.current) return;
    fetchPeopleRef.current()
      .then((items) => setPeopleSuggestions(items))
      .catch(() => setPeopleSuggestions([]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, '');

    const pageItems = q
      ? searchItems.filter((i) => i.label.toLowerCase().includes(q))
      : searchItems;

    if (!q) return pageItems;

    const extra = [];

    if (orderSuggestions) {
      const matchingOrders = orderSuggestions
        .filter((o) => o.shortId.toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
        .slice(0, 5)
        .map((o) => ({
          label: `#${o.shortId} — ${o.label}`,
          group: 'Orders',
          Icon: LuShoppingBag,
          isOrder: true,
          orderId: o._id,
          key: `__order__${o._id}`,
        }));
      extra.push(...matchingOrders);
    }

    if (peopleSuggestions) {
      peopleSuggestions
        .filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
        .slice(0, 6)
        .forEach((p) => {
          extra.push({
            label: `${p.name} — ${p.email}`,
            group: p.role === 'employee' ? 'Employees' : 'Clients',
            Icon: p.role === 'employee' ? LuBriefcase : LuUser,
            path: p.role === 'employee' ? `/admin/employees/${p._id}` : `/admin/clients/${p._id}`,
            key: `__person__${p._id}`,
          });
        });
    }

    return [...extra, ...pageItems];
  }, [query, searchItems, orderSuggestions, peopleSuggestions]);

  const go = (item) => {
    if (item.isOrder && onOrderSearch) {
      onOrderSearch(item.orderId);
    } else if (item.path) {
      navigate(item.path);
    }
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && filtered[cursor]) { go(filtered[cursor]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  const groups = [...new Set(filtered.map((i) => i.group))];

  return (
    <div className="cp-overlay" onClick={onClose}>
      <div className="cp-modal" onClick={(e) => e.stopPropagation()} onKeyDown={handleKey}>
        <div className="cp-input-wrap">
          <LuSearch size={16} className="cp-input-icon" />
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Search pages or type an order ID…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
          />
          <kbd className="cp-esc-hint">Esc</kbd>
        </div>
        <div className="cp-list">
          {filtered.length === 0 && query.trim() ? (
            <p className="cp-empty">No results for "{query}"</p>
          ) : (
            groups.map((group) => {
              const items = filtered.filter((i) => i.group === group);
              return (
                <div key={group}>
                  <span className="cp-group-label">{group}</span>
                  {items.map((item) => {
                    const absIdx = filtered.indexOf(item);
                    const ItemIcon = item.Icon;
                    return (
                      <button
                        key={item.key || item.path}
                        className={`cp-item${absIdx === cursor ? ' cp-item--active' : ''}`}
                        onMouseEnter={() => setCursor(absIdx)}
                        onClick={() => go(item)}
                      >
                        <ItemIcon size={15} className="cp-item-icon" />
                        <span>{item.label}</span>
                        {absIdx === cursor && <LuChevronRight size={13} className="cp-item-arrow" />}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div className="cp-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
