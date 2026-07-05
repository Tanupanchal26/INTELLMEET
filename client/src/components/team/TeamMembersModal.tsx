import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService, type Team, type TeamMember } from '../../api/team.api';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { useAppSelector } from '../../hooks/useAppDispatch';
import { usePresence } from '../../hooks/usePresence';
import { useSocket } from '../../hooks/useSocket';
import { Search, Trash2, Shield, ShieldAlert, User, UserPlus, Circle } from 'lucide-react';
import toast from 'react-hot-toast';

interface TeamMembersModalProps {
  team: Team;
  open: boolean;
  onClose: () => void;
}

const ROLE_POWER: Record<string, number> = { owner: 4, admin: 3, member: 2, guest: 1 };

export const TeamMembersModal = ({ team: initialTeam, open, onClose }: TeamMembersModalProps) => {
  const qc = useQueryClient();
  const currentUser = useAppSelector((s) => s.auth.user);
  const { isOnline } = usePresence();
  const { socket } = useSocket();
  const [search, setSearch] = useState('');

  // Always fetch live team data so newly added/removed members appear immediately
  const { data: liveTeam } = useQuery<Team>({
    queryKey: ['team', initialTeam._id],
    queryFn: () => teamService.getById(initialTeam._id).then((r: any) => r.data ?? r),
    enabled: open,
    staleTime: 0,
  });

  const team = liveTeam ?? initialTeam;

  // Listen for real-time member updates
  useEffect(() => {
    if (!socket.current) return;
    const onMembersUpdated = (updatedTeam: Team) => {
      if (updatedTeam._id === initialTeam._id) {
        qc.setQueryData(['team', initialTeam._id], updatedTeam);
      }
    };
    socket.current.on('team:members-updated', onMembersUpdated);
    return () => { socket.current!.off('team:members-updated', onMembersUpdated); };
  }, [initialTeam._id, qc]); // socket is a stable ref — safe to omit

  const currentMemberInfo = team.members.find(
    m => String(m.user._id) === String(currentUser?.id)
  );
  const currentRole = currentMemberInfo?.role ?? 'owner'; // default owner if you created the team
  const canManage = !currentMemberInfo || ROLE_POWER[currentRole] >= ROLE_POWER['admin'];

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['team-search-users', search],
    queryFn: () => teamService.searchUsersToInvite(search).then((r: any) => r.data),
    enabled: search.trim().length >= 2,
  });

  const inviteByEmailMutation = useMutation({
    mutationFn: (email: string) => teamService.inviteByEmail(team._id, email, 'member'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', team._id] });
      toast.success('Invitation sent to ' + search);
      setSearch('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to send invite'),
  });

  const inviteMutation = useMutation({
    mutationFn: (userId: string) => teamService.inviteMember(team._id, userId, 'member'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', team._id] });
      toast.success('Member invited');
      setSearch('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to invite'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => teamService.removeMember(team._id, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', team._id] });
      toast.success('Member removed');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to remove'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      teamService.updateMemberRole(team._id, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team', team._id] });
      toast.success('Role updated');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update role'),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Team Members (${team.members.length})`}>
      <div className="flex flex-col gap-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">

        {/* Invite Section */}
        {canManage && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Invite Member by Email or Name</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or enter email..."
                className="input-light pl-10"
              />
            </div>

            {search.trim().length >= 2 && (
              <div className="flex flex-col gap-2 mt-2 bg-[var(--color-bg-secondary)]/50 rounded-lg p-2 border border-[var(--color-border)]">
                {isFetching ? (
                  <p className="text-xs text-center text-[var(--color-text-muted)] py-2">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <p className="text-xs text-[var(--color-text-muted)]">No registered users found.</p>
                    {search.includes('@') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => inviteByEmailMutation.mutate(search)}
                        disabled={inviteByEmailMutation.isPending}
                        className="gap-2"
                      >
                        <UserPlus size={14} /> Invite {search} by Email
                      </Button>
                    )}
                  </div>
                ) : (
                  searchResults.map((u: any) => {
                    const existingMember = team.members.find(m => String(m.user._id) === String(u._id));
                    return (
                      <div key={u._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                              {u.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-[var(--color-text)]">{u.name}</span>
                            <span className="text-xs text-[var(--color-text-dim)]">{u.email}</span>
                          </div>
                        </div>
                        {existingMember ? (
                          <span className="text-xs font-medium text-[var(--color-text-muted)] px-2">
                            {existingMember.status === 'pending' ? 'Pending' : 'Member'}
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => inviteMutation.mutate(u._id)}
                            disabled={inviteMutation.isPending}
                            className="gap-2"
                          >
                            <UserPlus size={14} /> Invite
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        <hr className="border-[var(--color-border)]" />

        {/* Member List */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Current Members</h3>
          <div className="flex flex-col gap-2">
            {team.members.map((member: TeamMember) => {
              const isSelf = String(member.user._id) === String(currentUser?.id);
              const canEditThisUser = canManage && member.role !== 'owner' && currentRole === 'owner';
              const canRemoveThisUser = (canManage && ROLE_POWER[currentRole] > ROLE_POWER[member.role]) || isSelf;
              const online = isOnline(member.user._id);

              return (
                <div key={member.user._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors group">
                  <div className="flex items-center gap-3">
                    {/* Avatar with online dot */}
                    <div className="relative flex-shrink-0">
                      {member.user.avatar ? (
                        <img src={member.user.avatar} alt={member.user.name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <Circle
                        size={9}
                        className={`absolute bottom-0 right-0 ${online ? 'text-emerald-500 fill-emerald-500' : 'text-slate-300 fill-slate-300'}`}
                      />
                    </div>

                    {/* Name / Email / Role / Status */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--color-text)]">{member.user.name}</span>
                        {isSelf && <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase">You</span>}
                        {member.status === 'pending' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase">Pending</span>}
                      </div>
                      <span className="text-xs text-[var(--color-text-dim)]">{member.user.email}</span>
                      <span className={`text-[10px] font-semibold ${online ? 'text-emerald-600' : 'text-[var(--color-text-dim)]'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {canEditThisUser ? (
                      <select
                        value={member.role}
                        onChange={(e) => updateRoleMutation.mutate({ userId: member.user._id, role: e.target.value })}
                        disabled={updateRoleMutation.isPending}
                        className="text-xs font-semibold bg-transparent border border-[var(--color-border)] rounded-md px-2 py-1 outline-none focus:border-[var(--color-primary)] text-[var(--color-text)] cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="guest">Guest</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-1 rounded-md">
                        {member.role === 'owner' && <ShieldAlert size={12} className="text-amber-500" />}
                        {member.role === 'admin' && <Shield size={12} className="text-indigo-500" />}
                        {member.role === 'member' && <User size={12} />}
                        <span className="capitalize">{member.role}</span>
                      </div>
                    )}

                    {canRemoveThisUser && (
                      <button
                        onClick={() => removeMutation.mutate(member.user._id)}
                        disabled={removeMutation.isPending}
                        className="p-1.5 rounded-md text-[var(--color-text-dim)] hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title={isSelf ? 'Leave team' : 'Remove member'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
};
