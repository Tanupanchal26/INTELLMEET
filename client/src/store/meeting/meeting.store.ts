import { create } from 'zustand';

export interface Reaction {
  id: string;       // unique per emission
  socketId: string;
  userId: string;
  name: string;
  emoji: string;
}

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isHost: boolean;
  socketId: string;
  isSpeaking?: boolean;
  handRaised?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  roomId: string;
  host: string;
  startedAt?: string;
}

interface MeetingState {
  currentMeeting: Meeting | null;
  participants: Participant[];
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isInCall: boolean;
  isSpeaking: boolean;
  localHandRaised: boolean;  // local user's own hand state
  raisedHands: Set<string>;  // socketIds of remote participants
  reactions: Reaction[];     // ephemeral per-tile reactions keyed by socketId
  setCurrentMeeting: (m: Meeting | null) => void;
  setParticipants: (p: Participant[]) => void;
  addParticipant: (p: Participant) => void;
  removeParticipant: (socketId: string) => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  setScreenSharing: (v: boolean) => void;
  toggleScreenShare: () => void;
  toggleRecording: () => void;
  setInCall: (v: boolean) => void;
  setLocalSpeaking: (v: boolean) => void;
  setLocalHandRaised: (v: boolean) => void;
  setHandRaised: (socketId: string, raised: boolean) => void;
  addReaction: (r: Reaction) => void;
  removeReaction: (id: string) => void;
  resetMeeting: () => void;
  updateParticipant: (socketId: string, data: Partial<Participant>) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  currentMeeting: null,
  participants: [],
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
  isRecording: false,
  isInCall: false,
  isSpeaking: false,
  localHandRaised: false,
  raisedHands: new Set(),
  reactions: [],
  setCurrentMeeting: (m) => set((s) => {
    if (s.currentMeeting === m) return s;
    if (m && s.currentMeeting &&
      s.currentMeeting.id === m.id &&
      s.currentMeeting.roomId === m.roomId &&
      s.currentMeeting.title === m.title &&
      s.currentMeeting.host === m.host) return s;
    return { currentMeeting: m };
  }),
  setParticipants: (p) => set((s) => {
    if (s.participants === p) return s;
    return { participants: p };
  }),
  addParticipant: (p) => set((s) => ({ participants: [...s.participants.filter(x => x.socketId !== p.socketId), p] })),
  removeParticipant: (socketId) => set((s) => ({
    participants: s.participants.filter(p => p.socketId !== socketId),
    raisedHands: new Set([...s.raisedHands].filter(id => id !== socketId)),
  })),
  updateParticipant: (socketId, data) => set((s) => ({
    participants: s.participants.map(p => p.socketId === socketId ? { ...p, ...data } : p)
  })),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleVideo: () => set((s) => ({ isVideoOff: !s.isVideoOff })),
  setScreenSharing: (v) => set((s) => s.isScreenSharing === v ? s : { isScreenSharing: v }),
  toggleScreenShare: () => set((s) => ({ isScreenSharing: !s.isScreenSharing })),
  toggleRecording: () => set((s) => ({ isRecording: !s.isRecording })),
  setInCall: (v) => set((s) => s.isInCall === v ? s : { isInCall: v }),
  setLocalSpeaking: (v) => set((s) => s.isSpeaking === v ? s : { isSpeaking: v }),
  setLocalHandRaised: (v) => set((s) => s.localHandRaised === v ? s : { localHandRaised: v }),
  setHandRaised: (socketId, raised) => set((s) => {
    const next = new Set(s.raisedHands);
    raised ? next.add(socketId) : next.delete(socketId);
    return { raisedHands: next };
  }),
  addReaction: (r) => set((s) => ({ reactions: [...s.reactions, r] })),
  removeReaction: (id) => set((s) => ({ reactions: s.reactions.filter(r => r.id !== id) })),
  resetMeeting: () => set({ currentMeeting: null, participants: [], isMuted: false, isVideoOff: false, isScreenSharing: false, isRecording: false, isInCall: false, isSpeaking: false, localHandRaised: false, raisedHands: new Set(), reactions: [] }),
}));
