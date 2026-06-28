import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, uploadAvatar } from '../../api/auth';
import SettingsShell from '../../components/SettingsShell';
import NotificationPrefs from '../../components/NotificationPrefs';
import { LuUser, LuMapPin, LuBell, LuLock } from 'react-icons/lu';

import { mediaUrl } from '../../utils/media';

export default function ClientSettings() {
  const { user, setSession } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState({
    street: user?.address?.street || '',
    city: user?.address?.city || '',
    state: user?.address?.state || '',
    postalCode: user?.address?.postalCode || '',
    country: user?.address?.country || '',
  });
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrMsg, setAddrMsg] = useState('');
  const [addrErr, setAddrErr] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState(mediaUrl(user?.avatar));
  const [avatarFile, setAvatarFile] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const fileInputRef = useRef(null);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const setAddr = (k) => (e) => setAddress((a) => ({ ...a, [k]: e.target.value }));

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

  const handleSaveAddress = async () => {
    setSavingAddr(true); setAddrErr(''); setAddrMsg('');
    try {
      const r = await updateProfile({ phone, address });
      syncUser(r.data.user);
      setAddrMsg('Contact details updated.');
    } catch (err) {
      setAddrErr(err.response?.data?.message || 'Failed to update contact details.');
    } finally { setSavingAddr(false); }
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
          {profileErr && <p className="error-msg">{profileErr}</p>}
          {profileMsg && <p className="st-msg st-msg--ok">{profileMsg}</p>}
          <button className="btn-primary set-save" onClick={handleSaveProfile} disabled={savingProfile || !name || !email}>
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      ),
    },
    {
      id: 'contact', label: 'Contact', icon: <LuMapPin size={17} />,
      title: 'Contact & Address', desc: 'How we reach you and where to send deliverables.',
      render: () => (
        <div className="set-form">
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
          </div>
          <div className="form-group">
            <label>Street Address</label>
            <input type="text" value={address.street} onChange={setAddr('street')} placeholder="123 Main St, Apt 4" />
          </div>
          <div className="set-row-2">
            <div className="form-group"><label>City</label><input type="text" value={address.city} onChange={setAddr('city')} /></div>
            <div className="form-group"><label>State / Region</label><input type="text" value={address.state} onChange={setAddr('state')} /></div>
          </div>
          <div className="set-row-2">
            <div className="form-group"><label>Postal Code</label><input type="text" value={address.postalCode} onChange={setAddr('postalCode')} /></div>
            <div className="form-group"><label>Country</label><input type="text" value={address.country} onChange={setAddr('country')} /></div>
          </div>
          {addrErr && <p className="error-msg">{addrErr}</p>}
          {addrMsg && <p className="st-msg st-msg--ok">{addrMsg}</p>}
          <button className="btn-primary set-save" onClick={handleSaveAddress} disabled={savingAddr}>
            {savingAddr ? 'Saving…' : 'Save Contact Details'}
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
  ];

  return <SettingsShell subtitle="Manage your account information and preferences." sections={sections} />;
}
