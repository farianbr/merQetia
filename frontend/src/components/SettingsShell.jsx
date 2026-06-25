import { useState } from 'react';

/**
 * Premium settings layout: a left section rail + a single focused content panel.
 * Inspired by Apple's System Settings — one category visible at a time, calm
 * spacing, hairline dividers.
 *
 * @param {Object[]} sections - { id, label, icon, title, desc, render }
 */
export default function SettingsShell({ title = 'Settings', subtitle, sections = [] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const active = sections.find((s) => s.id === activeId) || sections[0];

  return (
    <div className="set-page">
      <header className="set-head">
        <h1 className="set-title">{title}</h1>
        {subtitle && <p className="set-sub">{subtitle}</p>}
      </header>

      <div className="set-body">
        <nav className="set-nav" aria-label="Settings sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`set-nav-item${s.id === active?.id ? ' set-nav-item--active' : ''}`}
              onClick={() => setActiveId(s.id)}
            >
              {s.icon && <span className="set-nav-icon">{s.icon}</span>}
              <span className="set-nav-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="set-content">
          {active && (
            <section className="set-panel" key={active.id}>
              <div className="set-panel-head">
                <h2 className="set-panel-title">{active.title || active.label}</h2>
                {active.desc && <p className="set-panel-desc">{active.desc}</p>}
              </div>
              <div className="set-panel-body">{active.render()}</div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
