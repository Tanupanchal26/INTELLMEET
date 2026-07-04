import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Calendar, Clock, Video, ArrowRight, Copy, Check } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { meetingService } from '../api/meeting.api';
import { MEETING_ROUTE } from '../constants';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';



const fmt = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Lobby = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [showStart, setShowStart] = useState(searchParams.get('join') !== null);
  const [createdMeeting, setCreatedMeeting] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [joinId, setJoinId] = useState(searchParams.get('join') ?? '');
  const [copied, setCopied] = useState<'id' | 'code' | 'link' | 'all' | null>(null);
  const qc = useQueryClient();

  const copyToClipboard = (text: string, type: 'id' | 'code' | 'link') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Fetch meetings — API returns { success, data, ... } which is unwrapped by axios to { success, data }
  // so meetings are at response.data
  const { data: meetingsResponse, isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => meetingService.getAll({ limit: 10 }).then((r: any) => r?.data ?? r ?? []),
  });
  const meetings = Array.isArray(meetingsResponse) ? meetingsResponse : [];

  const createMutation = useMutation({
    mutationFn: (payload: { title: string }) => {
      return meetingService.create(payload as any) as Promise<any>
    },
    onSuccess: (response: any) => {
      qc.invalidateQueries({ queryKey: ['meetings'] });
      // axios interceptor unwraps res.data → response is ApiResponse body {success, data: meeting}
      const meeting = response?.data ?? response;
      if (meeting?._id) {
        setCreatedMeeting(meeting);
        toast.success('Meeting created!');
      } else {
        toast.error('Meeting created but could not retrieve details');
      }
    },
    onError: (err: any) => {
      console.log("API Error:", err.response?.data || err.data);
      const status = err.status || err.response?.status;
      const apiData = err.response?.data || err.data;
      const fieldError = apiData?.errors?.[0]?.message;
      const validationMsg = fieldError || apiData?.message || err.message;

      if (status === 400) {
        toast.error(validationMsg || 'Invalid request data');
      } else if (status === 401) {
        toast.error('Authentication required. Please log in again.');
      } else if (status === 403) {
        toast.error('You do not have permission to create meetings.');
      } else if (status === 404) {
        toast.error('Resource not found.');
      } else if (status === 422) {
        toast.error(validationMsg || 'Validation failed');
      } else if (status === 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(validationMsg || 'Failed to create meeting');
      }
    },
  });

  const handleCreate = () => {
    if (createMutation.isPending) return;
    setCreatedMeeting(null);
    createMutation.mutate({ title: title.trim() || 'Quick Meeting' });
  };

  const handleJoinCreated = () => {
    if (createdMeeting?._id) {
      setShowCreate(false);
      setCreatedMeeting(null);
      navigate(MEETING_ROUTE(createdMeeting._id));
    }
  };

  const handleJoin = async () => {
    const code = joinId.trim();
    if (!code) return;

    try {
      const response: any = await meetingService.join(code);
      const meeting = response?.data ?? response;
      const id = meeting?._id || meeting?.id;
      if (id) {
        toast.success('Joined meeting!');
        navigate(MEETING_ROUTE(id));
      } else {
        toast.error('Could not retrieve meeting details');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Meeting not found. Check the ID or code.';
      toast.error(msg);
    }
  };

  return (
    <PageContainer className="flex flex-col gap-6 animate-fade-in text-[var(--color-text)] pb-12">
      <PageHeader
        title="Meetings"
        subtitle="Create, join or schedule meetings"
      />

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Create */}
        <Card hover className="flex flex-col gap-4 cursor-pointer" onClick={() => setShowCreate(true)}>
          <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center">
            <Plus size={22} className="text-[var(--color-text-muted)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)] mb-1">New Meeting</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Create a new meeting room and configure it</p>
          </div>
          <Button className="gap-2 w-fit">Create Now <ArrowRight size={13} /></Button>
        </Card>

        {/* Start / Join */}
        <Card hover className="flex flex-col gap-4 cursor-pointer" onClick={() => setShowStart(true)}>
          <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]/40 flex items-center justify-center">
            <Video size={22} className="text-[var(--color-text)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text)] mb-1">Start Meeting</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Start an existing scheduled meeting or join</p>
          </div>
          <Button variant="secondary" className="gap-2 w-fit">Start / Join <ArrowRight size={13} /></Button>
        </Card>
      </div>

      {/* Schedule card */}
      <Card className="flex items-center gap-4 cursor-pointer hover:border-[var(--color-primary)]/40 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-[#AFA9B4]/15 border border-[#AFA9B4]/25 flex items-center justify-center flex-shrink-0">
          <Calendar size={18} className="text-[var(--color-text)]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">Schedule for later</p>
          <p className="text-xs text-[var(--color-text-muted)]">Plan a future meeting and send calendar invites</p>
        </div>
        <Badge variant="info">Coming soon</Badge>
      </Card>

      {/* Recent meetings */}
      <div>
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Recent Meetings</h2>
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-dim)]">Loading sessions...</div>
          ) : meetings.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-dim)]">No recent meetings found</div>
          ) : (
            meetings.map((m: any) => (
              <div key={m._id} className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]/30 hover:bg-[var(--color-surface-hover)] transition-all cursor-pointer shadow-sm hover:shadow" onClick={() => m.status !== 'ended' && navigate(MEETING_ROUTE(m._id))}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${m.status === 'active' ? 'bg-[#AFA9B4]/20 border-[#AFA9B4]/30' : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]/60'}`}>
                  <Video size={16} className={m.status === 'active' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text)] truncate">{m.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={11} className="text-[var(--color-text-dim)]" />
                    <span className="text-xs text-[var(--color-text-dim)]">{fmt(m.startedAt || m.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.status === 'active' ? <Badge variant="success">Live</Badge> : m.status === 'ended' ? <Badge variant="default">Ended</Badge> : <Badge variant="info">Scheduled</Badge>}
                  {m.status !== 'ended' && <Button variant="ghost" size="sm" className="gap-1.5 font-bold hover:text-[var(--color-text)]">Join <ArrowRight size={12} /></Button>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreatedMeeting(null); }} title="Create New Meeting">
        <div className="flex flex-col gap-4">
          {!createdMeeting ? (
            <>
              <div>
                <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Meeting Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                  placeholder="e.g. Product Sync, Sprint Review..."
                  className="input-light"
                  disabled={createMutation.isPending}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowCreate(false)}
                  disabled={createMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  loading={createMutation.isPending}
                  onClick={handleCreate}
                  className="flex-1 gap-2"
                >
                  <Video size={14} /> Create Meeting
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-[var(--color-text)]">Meeting ready! Share these details:</p>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)] font-medium">Meeting ID</p>
                      <p className="text-sm font-mono font-bold text-[var(--color-text)]">{createdMeeting.meetingId}</p>
                    </div>
                    <button onClick={() => copyToClipboard(createdMeeting.meetingId, 'id')} className="p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors">
                      {copied === 'id' ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[var(--color-text-muted)]" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)] font-medium">Join Code</p>
                      <p className="text-sm font-mono font-bold text-[var(--color-text)]">{createdMeeting.joinCode}</p>
                    </div>
                    <button onClick={() => copyToClipboard(createdMeeting.joinCode, 'code')} className="p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors">
                      {copied === 'code' ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[var(--color-text-muted)]" />}
                    </button>
                  </div>

                  {createdMeeting.joinLink && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-[var(--color-text-muted)] font-medium">Join Link</p>
                        <p className="text-xs font-mono text-[var(--color-text)] truncate">{createdMeeting.joinLink}</p>
                      </div>
                      <button onClick={() => copyToClipboard(createdMeeting.joinLink, 'link')} className="p-1.5 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors ml-2 flex-shrink-0">
                        {copied === 'link' ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-[var(--color-text-muted)]" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => { setShowCreate(false); setCreatedMeeting(null); }}>
                  Close
                </Button>
                <Button
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => {
                    const parts = [
                      `Meeting ID: ${createdMeeting.meetingId}`,
                      `Join Code: ${createdMeeting.joinCode}`,
                      createdMeeting.joinLink ? `Join Link: ${createdMeeting.joinLink}` : '',
                    ].filter(Boolean).join('\n');
                    navigator.clipboard.writeText(parts).then(() => {
                      setCopied('all');
                      setTimeout(() => setCopied(null), 2000);
                    });
                  }}
                >
                  {copied === 'all' ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied === 'all' ? 'Copied!' : 'Copy All'}
                </Button>
                <Button className="flex-1 gap-2" onClick={handleJoinCreated}>
                  <Video size={14} /> Join Now
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Start / Join modal */}
      <Modal open={showStart} onClose={() => setShowStart(false)} title="Start or Join Meeting">
        <div className="flex flex-col gap-6">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Join by Meeting ID or Join Code</label>
            <div className="flex gap-2">
              <input
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter') handleJoin(); }}
                placeholder="e.g. ABCD-1234 or join code..."
                className="input-light flex-1"
              />
              <Button onClick={handleJoin} variant="secondary">Join</Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-2">Start a Scheduled Meeting</label>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="text-xs text-[var(--color-text-dim)]">Loading...</div>
              ) : meetings.length === 0 ? (
                <div className="text-xs text-[var(--color-text-dim)]">No upcoming meetings</div>
              ) : (
                meetings.map((m: any) => (
                  <div key={m._id} className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate text-[var(--color-text)]">{m.title}</span>
                      <span className="text-xs text-[var(--color-text-dim)]">{fmt(m.startedAt || m.createdAt)}</span>
                    </div>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(MEETING_ROUTE(m._id)); }}>Start</Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
             <Button variant="secondary" onClick={() => setShowStart(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};

export default Lobby;
