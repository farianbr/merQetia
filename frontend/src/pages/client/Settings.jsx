import { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { updateProfile, uploadAvatar } from '../../api/auth';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function ClientSettings() {
  const { user, setSession } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Contact & address
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

  const handleSaveAddress = async () => {
    setSavingAddr(true);
    setAddrErr('');
    setAddrMsg('');
    try {
      const r = await updateProfile({ phone, address });
      const updatedUser = r.data.user;
      const token = localStorage.getItem('token');
      if (token) setSession(token, updatedUser);
      else localStorage.setItem('user', JSON.stringify(updatedUser));
      setAddrMsg('Contact details updated.');
    } catch (err) {
      setAddrErr(err.response?.data?.message || 'Failed to update contact details.');
    } finally {
      setSavingAddr(false);
    }
  };

  const setAddr = (k) => (e) => setAddress((a) => ({ ...a, [k]: e.target.value }));

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState(
    user?.avatar ? `${API_BASE}${user.avatar}` : null
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const fileInputRef = useRef(null);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileErr('');
    setProfileMsg('');
    try {
      const r = await updateProfile({ name, email });
      const updatedUser = r.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileErr(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (newPw !== confirmPw) { setPwErr('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    setSavingPw(true);
    setPwErr('');
    setPwMsg('');
    try {
      await updateProfile({ currentPassword: currentPw, newPassword: newPw });
      setPwMsg('Password updated successfully.');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setPwErr(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setSavingPw(false);
    }
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
    setSavingAvatar(true);
    setAvatarMsg('');
    try {
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const r = await uploadAvatar(formData);
      const updatedUser = r.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setAvatarFile(null);
      setAvatarMsg('Photo updated.');
    } catch (err) {
      setAvatarMsg(err.response?.data?.message || 'Upload failed.');
    } finally {
      setSavingAvatar(false);
    }
  };

  return (
    <div className="st-page">
      <div className="st-header">
        <h1 className="st-title">Settings</h1>
        <p className="st-sub">Manage your account information and preferences.</p>
      </div>

      <div className="st-grid">
        {/* Profile Photo */}
        <section className="card st-card">
          <h2 className="st-section-title">Profile Photo</h2>
          <div className="st-avatar-row">
            <div className="st-avatar-wrap">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="st-avatar-img" />
              ) : (
                <div className="st-avatar-placeholder">{initials}</div>
              )}
            </div>
            <div className="st-avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
                Choose Photo
              </button>
              {avatarFile && (
                <button className="btn-primary" onClick={handleSaveAvatar} disabled={savingAvatar}>
                  {savingAvatar ? 'Uploading…' : 'Save Photo'}
                </button>
              )}
              {avatarMsg && <span className="st-msg">{avatarMsg}</span>}
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="card st-card">
          <h2 className="st-section-title">Account Info</h2>
          <div className="st-form">
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
            <button className="btn-primary" onClick={handleSaveProfile} disabled={savingProfile || !name || !email}>
              {savingProfile ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* Contact & Address */}
        <section className="card st-card">
          <h2 className="st-section-title">Contact &amp; Address</h2>
          <div className="st-form">
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
            </div>
            <div className="form-group">
              <label>Street Address</label>
              <input type="text" value={address.street} onChange={setAddr('street')} placeholder="123 Main St, Apt 4" />
            </div>
            <div className="st-addr-row">
              <div className="form-group">
                <label>City</label>
                <input type="text" value={address.city} onChange={setAddr('city')} />
              </div>
              <div className="form-group">
                <label>State / Region</label>
                <input type="text" value={address.state} onChange={setAddr('state')} />
              </div>
            </div>
            <div className="st-addr-row">
              <div className="form-group">
                <label>Postal Code</label>
                <input type="text" value={address.postalCode} onChange={setAddr('postalCode')} />
              </div>
              <div className="form-group">
                <label>Country</label>
                <input type="text" value={address.country} onChange={setAddr('country')} />
              </div>
            </div>
            {addrErr && <p className="error-msg">{addrErr}</p>}
            {addrMsg && <p className="st-msg st-msg--ok">{addrMsg}</p>}
            <button className="btn-primary" onClick={handleSaveAddress} disabled={savingAddr}>
              {savingAddr ? 'Saving…' : 'Save Contact Details'}
            </button>
          </div>
        </section>

        {/* Change Password */}
        <section className="card st-card">
          <h2 className="st-section-title">Change Password</h2>
          <div className="st-form">
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
            <button
              className="btn-primary"
              onClick={handleSavePassword}
              disabled={savingPw || !currentPw || !newPw || !confirmPw}
            >
              {savingPw ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
