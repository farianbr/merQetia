import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, uploadAvatar } from '../../api/auth';
import { getGoogleStatus, getGoogleAuthUrl, disconnectGoogle } from '../../api/integrations';
import SettingsShell from '../../components/SettingsShell';
import NotificationPrefs from '../../components/NotificationPrefs';
import { LuUser, LuBell, LuLock, LuTriangleAlert, LuPlug, LuCalendarCheck, LuCircleCheck } from 'react-icons/lu';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

/* ── Google Calendar integration panel ── */
function GoogleIntegration() {
  const [status, setStatus] = useState(null); // { configured, connected, connectedEmail }
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const loadStatus = () => {
    setLoading(true);
    getGoogleStatus()
      .then((r) => setStatus(r.data))
      .catch(() => setErr('Could not load integration status.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
    // Reflect the OAuth callback outcome (?google=connected|error|denied)
    const params = new URLSearchParams(window.location.search);
    const g = params.get('google');
    if (g === 'connected') setMsg('Google Calendar connected.');
    else if (g === 'denied') setErr('Connection was cancelled.');
    else if (g === 'error') setErr('Could not connect Google Calendar. Please try again.');
    if (g) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleConnect = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await getGoogleAuthUrl();
      window.location.href = r.data.url; // redirect to Google consent
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not start the connection.');
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      await disconnectGoogle();
      setMsg('Google Calendar disconnected.');
      loadStatus();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not disconnect.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div className="set-form">
      <div className="set-integration">
        <span className="set-integration-icon"><LuCalendarCheck size={22} /></span>
        <div className="set-integration-body">
          <span className="set-integration-name">Google Calendar</span>
          <span className="set-integration-desc">
            Schedule client meetings as Google Calendar events with a Meet link. Invites are emailed
            straight to the client.
          </span>
          {status?.connected && (
            <span className="set-integration-status">
              <LuCircleCheck size={14} color="#10b981" /> Connected{status.connectedEmail ? ` as ${status.connectedEmail}` : ''}
            </span>
          )}
        </div>
        <div className="set-integration-action">
          {!status?.configured ? (
            <span className="st-msg">Not configured on the server.</span>
          ) : status.connected ? (
            <button className="btn-danger-outline" onClick={handleDisconnect} disabled={busy}>
              {busy ? '…' : 'Disconnect'}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleConnect} disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </div>
      {err && <p className="error-msg">{err}</p>}
      {msg && <p className="st-msg st-msg--ok">{msg}</p>}
    </div>
  );
}

export default function AdminSettings() {
  const { user, setSession } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ? `${API_BASE}${user.avatar}` : null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const fileInputRef = useRef(null);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  const syncUser = (updatedUser) => {
    const token = localStorage.getItem('token');
    if (token) setSession(token, updatedUser);
    else localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true); setProfileErr(''); setProfileMsg('');
    try {
      const r = await updateProfile({ name, email });
      syncUser(r.data.user);
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileErr(err.response?.data?.message || 'Failed to update profile.');
    } finally { setSavingProfile(false); }
  };

  const handleSavePassword = async () => {
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    setSavingPw(true); setPwErr(''); setPwMsg('');
    try {
      await updateProfile({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg('Password updated successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwErr(err.response?.data?.message || 'Failed to update password.');
    } finally { setSavingPw(false); }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarMsg('');
  };

  const handleSaveAvatar = async () => {
    if (!avatarFile) return;
    setSavingAvatar(true); setAvatarMsg('');
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const r = await uploadAvatar(formData);
      syncUser(r.data.user);
      setAvatarFile(null);
      setAvatarMsg('Photo updated.');
    } catch (err) {
      setAvatarMsg(err.response?.data?.message || 'Upload failed.');
    } finally { setSavingAvatar(false); }
  };

  const sections = [
    {
      id: 'profile', label: 'Profile', icon: <LuUser size={17} />,
      title: 'Profile', desc: 'Your photo and account identity.',
      render: () => (
        <div className="set-form">
          <div className="set-avatar-row">
            <div className="set-avatar">
              {avatarPreview ? <img src={avatarPreview} alt="Profile" /> : <span>{initials}</span>}
            </div>
            <div className="set-avatar-actions">
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>Choose Photo</button>
              {avatarFile && (
                <button className="btn-primary" onClick={handleSaveAvatar} disabled={savingAvatar}>
                  {savingAvatar ? 'Uploading…' : 'Save Photo'}
                </button>
              )}
              {avatarMsg && <span className="st-msg st-msg--ok">{avatarMsg}</span>}
            </div>
          </div>

          <div className="set-divider" />

          <div className="form-group">
            <label>Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Role</label>
            <input type="text" value="Administrator" readOnly className="input-readonly" />
          </div>
          {profileErr && <p className="error-msg">{profileErr}</p>}
          {profileMsg && <p className="st-msg st-msg--ok">{profileMsg}</p>}
          <button className="btn-primary set-save" onClick={handleSaveProfile} disabled={savingProfile || !name || !email}>
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      ),
    },
    {
      id: 'notifications', label: 'Notifications', icon: <LuBell size={17} />,
      title: 'Notifications', desc: 'Choose exactly what you want to be notified about, and where.',
      render: () => <NotificationPrefs />,
    },
    {
      id: 'integrations', label: 'Integrations', icon: <LuPlug size={17} />,
      title: 'Integrations', desc: 'Connect third-party services used across merQetia.',
      render: () => <GoogleIntegration />,
    },
    {
      id: 'security', label: 'Security', icon: <LuLock size={17} />,
      title: 'Security', desc: 'Update your password.',
      render: () => (
        <div className="set-form">
          <div className="form-group">
            <label>Current Password</label>
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
          </div>
          {pwErr && <p className="error-msg">{pwErr}</p>}
          {pwMsg && <p className="st-msg st-msg--ok">{pwMsg}</p>}
          <button className="btn-primary set-save" onClick={handleSavePassword} disabled={savingPw || !currentPw || !newPw || !confirmPw}>
            {savingPw ? 'Updating…' : 'Update Password'}
          </button>
        </div>
      ),
    },
    {
      id: 'danger', label: 'Danger Zone', icon: <LuTriangleAlert size={17} />,
      title: 'Danger Zone', desc: 'These actions are irreversible. Please be certain.',
      render: () => (
        <div className="set-danger-row">
          <div>
            <span className="set-danger-title">Sign out of all sessions</span>
            <span className="set-danger-sub">Remove all active login sessions for this account.</span>
          </div>
          <button className="btn-danger-outline" onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
            Sign Out Everywhere
          </button>
        </div>
      ),
    },
  ];

  return <SettingsShell subtitle="Manage your admin account information and preferences." sections={sections} />;
}
