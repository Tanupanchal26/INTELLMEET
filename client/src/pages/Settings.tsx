import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, Lock, Bell, Palette, Shield, Save,
  Puzzle, Brain, Trash2, ExternalLink, Check, LogOut, Upload, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { useAppSelector, useAppDispatch } from '../hooks/useAppDispatch';
import { setCredentials } from '../store/auth/auth.slice';
import { setTheme, setDensity } from '../store/ui/ui.slice';
import { ROUTES } from '../constants';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

type Tab = 'profile' | 'security' | 'notifications' | 'appearance' | 'integrations' | 'ai';

const TABS: { id: Tab; label: string; icon: React.ElementType; group?: string }[] = [
  { id: 'profile',       label: 'Profile',        icon: User,       group: 'Account' },
  { id: 'security',      label: 'Security',        icon: Shield,     group: 'Account' },
  { id: 'notifications', label: 'Notifications',   icon: Bell,       group: 'Account' },
  { id: 'appearance',    label: 'Appearance',      icon: Palette,    group: 'Account' },
  { id: 'integrations',  label: 'Integrations',    icon: Puzzle,     group: 'Workspace' },
  { id: 'ai',            label: 'AI Preferences',  icon: Brain,      group: 'Workspace' },
];

/* ── Toggle switch ── */
interface ToggleProps { id: string; checked: boolean; onChange: () => void; label: string; }
const Toggle = ({ id, checked, onChange, label }: ToggleProps) => (
  <button
    id={id}
    role="switch"
    aria-checked={checked ? 'true' : 'false'}
    aria-label={label}
    onClick={onChange}
    className={clsx(
      'relative w-10 h-[22px] rounded-full shrink-0 transition-all duration-200 outline-none border cursor-pointer',
      'focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg)]',
      checked ? 'bg-indigo-600 border-indigo-500 shadow-sm' : 'bg-[var(--color-bg-tertiary)] border-[var(--color-border)]'
    )}
  >
    <span
      className={clsx(
        'absolute top-0.5 left-0.5 w-[16px] h-[16px] rounded-full bg-white',
        'shadow-[0_1px_3px_rgba(0,0,0,0.15)]',
        'transition-all duration-200',
        checked ? 'translate-x-[18px]' : 'bg-[var(--color-border)]'
      )}
    />
  </button>
);

/* ── Avatar Upload with crop, compress, preview, progress ── */
const AvatarUpload = ({ name }: { name: string }) => {
  const fileRef  = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [cropSrc,  setCropSrc]  = useState<string | null>(null);

  /** Compress + crop to square via canvas */
  const processImage = (file: File): Promise<Blob> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 256;
        const canvas = canvasRef.current!;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const sx  = (img.width  - min) / 2;
        const sy  = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, SIZE, SIZE);
        canvas.toBlob((blob) => resolve(blob!), 'image/webp', 0.82);
      };
      img.src = URL.createObjectURL(file);
    });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 8 * 1024 * 1024)    { toast.error('Image must be under 8 MB');    return; }

    const blob    = await processImage(file);
    const dataUrl = URL.createObjectURL(blob);
    setPreview(dataUrl);
    setCropSrc(null);

    setUploading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.webp');

    try {
      await (api as any).post('/users/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e: ProgressEvent) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setProgress(100);
      toast.success('Avatar updated!');
    } catch (err: any) {
      setPreview(null);
      toast.error(err?.message ?? 'Upload failed — please try again');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4 mb-6 p-4 rounded-xl bg-[var(--color-surface-2)]/40 border border-[var(--color-border)] shadow-sm">
      <canvas ref={canvasRef} className="hidden" />

      {/* Avatar preview */}
      <div className="relative shrink-0">
        {preview ? (
          <img
            src={preview}
            alt="Avatar preview"
            className="w-14 h-14 rounded-2xl object-cover ring-2 ring-[var(--color-primary)]/20"
          />
        ) : (
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold"
            style={{ background: 'var(--color-primary)' }}
          >
            {name.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        {preview && (
          <button
            onClick={() => setPreview(null)}
            className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-red-500 transition-colors cursor-pointer"
          >
            <X size={9} />
          </button>
        )}
      </div>

      {/* Info + upload button + progress */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[var(--color-text)]">{name || 'Your Name'}</p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">WebP · max 8 MB · auto-cropped to square</p>

        {uploading && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--color-text-secondary)]">Uploading…</span>
              <span className="text-[10px] text-[var(--color-text-secondary)]">{progress}%</span>
            </div>
            <div className="h-1 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {!uploading && (
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-primary-hover)] hover:text-[var(--color-primary)] transition-colors font-semibold cursor-pointer"
          >
            <Upload size={11} />
            {preview ? 'Change photo' : 'Upload photo'}
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
      </div>
    </div>
  );
};

const SectionHeader = ({ title, desc }: { title: string; desc?: string }) => (
  <div className="mb-5">
    <h2 className="text-[0.9375rem] font-bold text-[var(--color-text)] tracking-tight">{title}</h2>
    {desc && <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed font-semibold">{desc}</p>}
  </div>
);

/* ── Row item for notification/settings toggles ── */
const SettingRow = ({
  title, desc, id, checked, onChange,
}: { title: string; desc: string; id: string; checked: boolean; onChange: () => void }) => (
  <div className="flex items-center justify-between py-3.5 border-b border-[var(--color-border)]/50 last:border-0">
    <div className="flex-1 pr-6">
      <label htmlFor={id} className="text-sm font-bold text-[var(--color-text)] cursor-pointer">{title}</label>
      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed font-medium">{desc}</p>
    </div>
    <Toggle id={id} checked={checked} onChange={onChange} label={title} />
  </div>
);

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlTab = (searchParams.get('tab') ?? 'profile').toLowerCase() as Tab;
  const validTabs = useMemo(() => new Set<Tab>(TABS.map(t => t.id)), []);

  useEffect(() => {
    if (validTabs.has(urlTab)) {
      setTab(urlTab);
      return;
    }
    setTab('profile');
    setSearchParams({ tab: 'profile' }, { replace: true });
  }, [urlTab, validTabs, setSearchParams]);

  const dispatch = useAppDispatch();
  const { user, logout } = useAuth();
  const theme = useAppSelector((s) => s.ui.theme);
  const density = useAppSelector((s) => s.ui.density);
  const [tab,  setTab]  = useState<Tab>('profile');
  const [name, setName] = useState(user?.name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  const [notifs, setNotifs] = useState({
    email: true, push: true, digest: false, mentions: true,
    meetingInvite: true, taskAssigned: true, aiSummary: true,
  });

  const [ai, setAI] = useState({
    autoSummary: true, actionItems: true, transcription: true,
    suggestions: false, searchHistory: true,
  });

  const toggleNotif = (k: keyof typeof notifs) =>
    setNotifs(n => ({ ...n, [k]: !n[k] }));

  const toggleAI = (k: keyof typeof ai) =>
    setAI(a => ({ ...a, [k]: !a[k] }));

  const save = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSavingProfile(true);
    try {
      const res = (await api.put('/users/me', { name: name.trim() })) as any;
      const updated = res?.data?.user ?? res?.user ?? res?.data ?? res;
      dispatch(setCredentials({ user: { ...user, ...updated }, accessToken: undefined as any }));
      toast.success('Profile saved!');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) { toast.error('All password fields are required'); return; }
    if (pwForm.next !== pwForm.confirm) { toast.error('New passwords do not match'); return; }
    if (pwForm.next.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      toast.success('Password updated!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update password');
    } finally {
      setSavingPw(false);
    }
  };

  const handleLogout = logout;

  const tabGroups = ['Account', 'Workspace'];

  const handleTabClick = (next: Tab) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: false });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl font-sans text-[var(--color-text)]">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Settings</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 font-medium">Manage your account and workspace preferences</p>
      </motion.div>

      <div className="flex gap-6 flex-col md:flex-row">

        {/* ── Tab list ── */}
        <nav className="flex md:flex-col gap-2 md:w-52 flex-shrink-0 flex-wrap" aria-label="Settings navigation">
          {tabGroups.map(group => (
            <div key={group} className="flex md:flex-col gap-1 w-full">
              <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.1em] px-2.5 py-1 hidden md:block">
                {group}
              </p>
              {TABS.filter(t => t.group === group).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabClick(id as Tab)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={clsx(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.8125rem] font-bold transition-all text-left cursor-pointer border',
                    tab === id
                      ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] border-[var(--color-primary-border)] shadow-sm'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] border-transparent'
                  )}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          ))}
          
          <div className="pt-4 mt-4 border-t border-[var(--color-border)] hidden md:block">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[0.8125rem] font-bold text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-all text-left w-full cursor-pointer"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </nav>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >

              {/* Profile */}
              {tab === 'profile' && (
                <Card>
                  <SectionHeader title="Profile Information" desc="Your public name and email visible to team members." />
                  <AvatarUpload name={name} />
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="settings-name" className="text-xs font-bold text-[var(--color-text-secondary)] block uppercase tracking-wider">Full Name</label>
                      <input id="settings-name" type="text" value={name} onChange={e => setName(e.target.value)} className="input-light" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="settings-email" className="text-xs font-bold text-[var(--color-text-secondary)] block uppercase tracking-wider">Email Address</label>
                      <input id="settings-email" type="email" value={user?.email ?? ''} readOnly className="input-light opacity-50 cursor-not-allowed" />
                      <p className="text-[11px] text-[var(--color-text-dim)] font-medium">Email changes require verification. Contact support.</p>
                    </div>
                    <div className="flex justify-end pt-1">
                      <Button loading={savingProfile} onClick={save} leftIcon={<Save size={13} />}>Save Changes</Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Security */}
              {tab === 'security' && (
                <div className="flex flex-col gap-4">
                  <Card>
                    <SectionHeader title="Change Password" />
                    <div className="flex flex-col gap-4">
                      {[
                        { id: 'cur-pass', label: 'Current Password', key: 'current' as const },
                        { id: 'new-pass', label: 'New Password', key: 'next' as const },
                        { id: 'cfm-pass', label: 'Confirm New Password', key: 'confirm' as const },
                      ].map(({ id, label, key }) => (
                        <div key={id} className="flex flex-col gap-1.5">
                          <label htmlFor={id} className="text-xs font-bold text-[var(--color-text-secondary)] block uppercase tracking-wider">{label}</label>
                          <input id={id} type="password" placeholder="••••••••" className="input-light" autoComplete="new-password" value={pwForm[key]} onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))} />
                        </div>
                      ))}
                      <div className="flex justify-end">
                        <Button loading={savingPw} onClick={changePassword} leftIcon={<Lock size={13} />}>Update Password</Button>
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <SectionHeader title="Two-Factor Authentication" desc="Add an extra layer of security to your account." />
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text)]">Authenticator App</p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">Use an app like Authy or Google Authenticator</p>
                      </div>
                      <Button variant="secondary" size="sm">Enable</Button>
                    </div>
                  </Card>

                  <Card variant="danger">
                    <SectionHeader title="Danger Zone" desc="Permanent and irreversible actions." />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-red-900">Delete Account</p>
                        <p className="text-xs text-red-700 mt-0.5 font-medium">Permanently delete your account and all data</p>
                      </div>
                      <Button variant="danger" size="sm" leftIcon={<Trash2 size={13} />}>Delete Account</Button>
                    </div>
                  </Card>
                </div>
              )}

              {/* Notifications */}
              {tab === 'notifications' && (
                <Card>
                  <SectionHeader title="Notification Preferences" desc="Choose what you want to be notified about." />
                  <div className="flex flex-col">
                    <SettingRow title="Email Notifications" desc="Receive meeting summaries and alerts via email" id="n-email" checked={notifs.email} onChange={() => toggleNotif('email')} />
                    <SettingRow title="Push Notifications" desc="Browser push for real-time meeting alerts" id="n-push" checked={notifs.push} onChange={() => toggleNotif('push')} />
                    <SettingRow title="Daily Digest" desc="Morning summary of tasks and upcoming meetings" id="n-digest" checked={notifs.digest} onChange={() => toggleNotif('digest')} />
                    <SettingRow title="Mentions" desc="Notify when someone @mentions you in channels" id="n-mentions" checked={notifs.mentions} onChange={() => toggleNotif('mentions')} />
                    <SettingRow title="Meeting Invites" desc="Get notified when you're added to a meeting" id="n-invite" checked={notifs.meetingInvite} onChange={() => toggleNotif('meetingInvite')} />
                    <SettingRow title="Task Assignments" desc="Notify when a task is assigned to you" id="n-task" checked={notifs.taskAssigned} onChange={() => toggleNotif('taskAssigned')} />
                    <SettingRow title="AI Summaries Ready" desc="Notify when AI finishes processing a meeting" id="n-ai" checked={notifs.aiSummary} onChange={() => toggleNotif('aiSummary')} />
                  </div>
                </Card>
              )}

              {/* Appearance */}
              {tab === 'appearance' && (
                <Card>
                  <SectionHeader title="Theme" desc="Configure IntellMeet display theme options." />
                  <div className="flex gap-3 mb-6">
                    {(['Dark', 'Light', 'System'] as const).map(t => {
                      const themeVal = t.toLowerCase() as 'dark' | 'light' | 'system';
                      const isActive = theme === themeVal;
                      return (
                        <button
                          key={t}
                          onClick={() => dispatch(setTheme(themeVal))}
                          className={clsx(
                            'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5',
                            isActive
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] font-bold shadow-sm'
                              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] bg-[var(--color-surface-2)]/40'
                          )}
                          aria-pressed={isActive ? 'true' : 'false'}
                        >
                          {isActive && <Check size={13} />}
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <SectionHeader title="Density" desc="Control how compact the interface appears." />
                  <div className="flex gap-3">
                    {(['Comfortable', 'Compact'] as const).map(d => {
                      const densityVal = d.toLowerCase() as 'comfortable' | 'compact';
                      const isActive = density === densityVal;
                      return (
                        <button
                          key={d}
                          onClick={() => dispatch(setDensity(densityVal))}
                          className={clsx(
                            'flex-1 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5',
                            isActive
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary-hover)] font-bold shadow-sm'
                              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] bg-[var(--color-surface-2)]/40'
                          )}
                          aria-pressed={isActive ? 'true' : 'false'}
                        >
                          {isActive && <Check size={13} />}
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}



              {/* Integrations */}
              {tab === 'integrations' && (
                <Card>
                  <SectionHeader title="Integrations" desc="Connect IntellMeet with your favourite tools." />
                  <div className="flex flex-col gap-3">
                    {[
                      { name: 'Slack',              desc: 'Post meeting summaries to channels', connected: true },
                      { name: 'Google Calendar',    desc: 'Sync meetings with your calendar', connected: true },
                      { name: 'Notion',             desc: 'Export notes and summaries to Notion', connected: false },
                      { name: 'Linear',             desc: 'Create issues from action items', connected: false },
                      { name: 'Jira',               desc: 'Sync tasks with Jira projects', connected: false },
                    ].map(({ name, desc, connected }) => (
                      <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-white/40 border border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-white/60 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-[var(--color-text)]">{name}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">{desc}</p>
                        </div>
                        {connected ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="success" dot>Connected</Badge>
                            <Button variant="ghost" size="xs" className="text-[var(--color-text-secondary)]">Disconnect</Button>
                          </div>
                        ) : (
                          <Button variant="secondary" size="sm" rightIcon={<ExternalLink size={11} />}>Connect</Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* AI Preferences */}
              {tab === 'ai' && (
                <Card>
                  <SectionHeader title="AI Preferences" desc="Configure how IntellMeet's AI assistant behaves." />
                  <div className="flex flex-col">
                    <SettingRow title="Auto-generate Summaries" desc="Automatically generate AI summary after each meeting ends" id="ai-summary" checked={ai.autoSummary} onChange={() => toggleAI('autoSummary')} />
                    <SettingRow title="Extract Action Items" desc="Automatically identify and extract tasks from transcripts" id="ai-actions" checked={ai.actionItems} onChange={() => toggleAI('actionItems')} />
                    <SettingRow title="Live Transcription" desc="Enable real-time speech-to-text during meetings" id="ai-transcript" checked={ai.transcription} onChange={() => toggleAI('transcription')} />
                    <SettingRow title="AI Suggestions" desc="Receive proactive suggestions during meetings" id="ai-suggest" checked={ai.suggestions} onChange={() => toggleAI('suggestions')} />
                    <SettingRow title="Search History" desc="Allow AI to reference past meetings when answering questions" id="ai-history" checked={ai.searchHistory} onChange={() => toggleAI('searchHistory')} />
                  </div>
                </Card>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Settings;
