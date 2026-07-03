import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../hooks/useAppDispatch';
import { setCredentials } from '../store/auth/auth.slice';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { Save, Video, Brain, CheckSquare, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { clearAuth } from '../store/auth/auth.slice';
import { authService } from '../api/auth.api';
import api from '../api/axios';
import { ROUTES, STORAGE_KEYS } from '../constants';

const Profile = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const STATS = [
    { label: 'Meetings', value: '28', icon: Video, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10' },
    { label: 'AI Summaries', value: '19', icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Tasks Done', value: '47', icon: CheckSquare, color: 'text-green-400', bg: 'bg-green-500/10' },
  ];

  const handleLogout = async () => {
    try {
      // 1. Call Logout API
      await authService.logout().catch(() => {});

      // 2. Clear state and storage
      dispatch(clearAuth());
      localStorage.clear();
      sessionStorage.clear();
      
      toast.success('Signed out successfully');
      // 3. Redirect to public homepage and replace history stack
      navigate("/", { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      dispatch(clearAuth());
      localStorage.clear();
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-fade-in max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Profile</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-[var(--color-text-muted)] hover:text-red-500 gap-2">
          <LogOut size={14} /> Sign out
        </Button>
      </div>

      <Card className="flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-purple-500 flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
          {(user?.name || 'U').charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">{user?.name}</h2>
          <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
          <Badge variant="purple" className="mt-2">Pro Member</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label} hover className="text-center flex flex-col items-center gap-2">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-xl font-bold text-[var(--color-text)]">{value}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-semibold text-[var(--color-text)] mb-4">Edit Profile</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Email</label>
            <input value={user?.email || ''} disabled className="input-dark opacity-60" />
          </div>
          <Button
            loading={saving}
            onClick={async () => {
              if (!name.trim()) { toast.error('Name cannot be empty'); return; }
              setSaving(true);
              try {
                const res = (await api.put('/users/me', { name: name.trim() })) as any;
                const updated = res?.data?.user ?? res?.user ?? res?.data ?? res;
                dispatch(setCredentials({ user: { ...user, ...updated }, accessToken: undefined as any }));
                toast.success('Profile updated!');
              } catch (err: any) {
                toast.error(err?.message ?? 'Failed to update profile');
              } finally {
                setSaving(false);
              }
            }}
            className="gap-2 w-fit"
          >
            <Save size={14} />Save Changes
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
