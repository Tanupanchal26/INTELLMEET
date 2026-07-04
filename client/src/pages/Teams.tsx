import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Lock, UserPlus, Trash2 } from 'lucide-react';
import { teamService, type Team } from '../api/team.api';
import { toTeam } from '../constants';
import { useAppSelector } from '../hooks/useAppDispatch';
import { TeamMembersModal } from '../components/team/TeamMembersModal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Badge from '../components/common/Badge';
import Loader from '../components/common/Loader';
import toast from 'react-hot-toast';

const Teams = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = true;
  const [showCreate, setShowCreate] = useState(false);
  const [inviteTeam, setInviteTeam] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isPrivate: false });

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => teamService.list().then((r: any) => r?.data ?? r ?? []),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => teamService.create(data),
    onSuccess: async (res: any) => {
      await qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created! Invite members now.');
      setShowCreate(false);
      setForm({ name: '', description: '', isPrivate: false });
      // Open invite modal for the newly created team (use response data directly)
      const newTeam: Team = res?.data ?? res;
      if (newTeam?._id) setInviteTeam(newTeam);
    },
    onError: () => toast.error('Failed to create team'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); toast.success('Team deleted'); },
    onError: () => toast.error('Failed to delete team'),
  });

  if (isLoading) return <Loader fullPage />;

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Teams</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{teams.length} team{teams.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus size={15} /> New Team
          </Button>
        )}
      </div>

      {teams.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-4">
          <Users size={40} className="text-[var(--color-text-dim)]" />
          <p className="text-[var(--color-text-muted)]">No teams yet.</p>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus size={14} /> Create Team</Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Card key={team._id} hover className="flex flex-col gap-3 cursor-pointer group" onClick={() => navigate(toTeam(team._id))}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {team.avatar ? (
                    <img src={team.avatar} alt={team.name} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center text-[var(--color-primary)] font-bold text-lg">
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[var(--color-text)]">{team.name}</p>
                      {team.isPrivate && <Lock size={12} className="text-[var(--color-text-dim)]" />}
                    </div>
                    <p className="text-xs text-[var(--color-text-dim)]">#{team.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setInviteTeam(team); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--color-text-dim)] hover:text-indigo-500 hover:bg-indigo-500/10 transition-all"
                    title="Invite Member"
                  >
                    <UserPlus size={14} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(team._id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--color-text-dim)] hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Delete Team"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {team.description && (
                <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">{team.description}</p>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-dim)]">
                  <Users size={12} />
                  <span>{team.members?.length ?? 0} members</span>
                </div>
                <Badge variant={team.isPrivate ? 'warning' : 'info'} className="text-[10px]">
                  {team.isPrivate ? 'Private' : 'Public'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {inviteTeam && (
        <TeamMembersModal
          team={inviteTeam}
          open={!!inviteTeam}
          onClose={() => setInviteTeam(null)}
        />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Team">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Team Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Engineering"
              className="input-light"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="What is this team about?"
              rows={3}
              className="input-light resize-none"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) => setForm((p) => ({ ...p, isPrivate: e.target.checked }))}
              className="rounded"
            />
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">Private team</p>
              <p className="text-xs text-[var(--color-text-dim)]">Only invited members can see this team</p>
            </div>
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="flex-1" onClick={() => createMutation.mutate(form)} disabled={!form.name.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Team'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Teams;
