import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function LogoutButton({ className = '' }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function logout() {
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/logout');
      sessionStorage.removeItem('campusconnect_token');
      sessionStorage.removeItem('campusconnect_user');
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to end this session. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button type="button" disabled={saving} onClick={logout} className={className}>
        {saving ? 'Signing out...' : 'Sign out'}
      </button>
      {error && <p role="alert" className="mt-2 max-w-xs text-xs text-red-500">{error}</p>}
    </div>
  );
}
