import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ChannelChat from '../../components/ChannelChat';
import { getChannels, getChannelMentionables } from '../../api/team';
import { LuHash, LuUsers } from 'react-icons/lu';

function initialsOf(name) {
  return (name || '—').split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * Employee team page — teammates roster, the org-wide #merQetia channel, and a
 * chat for each department the employee belongs to (with meeting scheduling).
 */
export default function EmployeeTeam() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChannels()
      .then((r) => {
        const list = r.data.channels || [];
        setChannels(list);
        const fromQuery = searchParams.get('channel');
        const preset = list.find((c) => c._id === fromQuery);
        setActiveId(preset?._id || list[0]?._id || null);
      })
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Teammate roster = the active channel's other members (mentionables, sans groups).
  useEffect(() => {
    if (!activeId) return;
    getChannelMentionables(activeId)
      .then((r) => setRoster((r.data.participants || []).filter((p) => p.role !== 'department')))
      .catch(() => setRoster([]));
  }, [activeId]);

  const activeChannel = useMemo(() => channels.find((c) => c._id === activeId) || null, [channels, activeId]);

  const selectChannel = (id) => {
    setActiveId(id);
    setSearchParams({ channel: id }, { replace: true });
  };

  return (
    <div className="page">
      <div className="section-header">
        <div>
          <h1>Team</h1>
          <p className="subtitle">Chat with your teammates and the wider merQetia team.</p>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading…</div>
      ) : channels.length === 0 ? (
        <div className="tm-empty"><LuUsers size={36} /><p>No team channels available yet.</p></div>
      ) : (
        <div className="tc-layout">
          {/* Sidebar: channels + teammates */}
          <aside className="tc-sidebar">
            <div className="tc-side-section">
              <span className="tc-side-label">Channels</span>
              {channels.map((c) => (
                <button
                  key={c._id}
                  className={`tc-channel ${c._id === activeId ? 'tc-channel--active' : ''}`}
                  onClick={() => selectChannel(c._id)}
                >
                  {c.kind === 'org' ? <LuHash size={15} /> : <LuUsers size={15} />}
                  <span className="tc-channel-name">{c.name}</span>
                </button>
              ))}
            </div>

            <div className="tc-side-section">
              <span className="tc-side-label">
                {activeChannel?.kind === 'org' ? 'Members' : 'Teammates'} ({roster.length + 1})
              </span>
              <div className="tc-roster">
                <div className="tc-roster-item">
                  <span className="tc-roster-avatar tc-roster-avatar--me">{initialsOf(user?.name)}</span>
                  <span className="tc-roster-name">{user?.name} <span className="tc-role">you</span></span>
                </div>
                {roster.map((p) => (
                  <div key={p._id} className="tc-roster-item">
                    <span className="tc-roster-avatar">{initialsOf(p.name)}</span>
                    <span className="tc-roster-name">{p.name} <span className="tc-role">{p.role}</span></span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Chat */}
          {activeChannel && <ChannelChat key={activeChannel._id} channel={activeChannel} />}
        </div>
      )}
    </div>
  );
}
