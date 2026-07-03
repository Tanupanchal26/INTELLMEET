import { create } from 'zustand';

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isHost: boolean;
  socketId: string;
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
  setCurrentMeeting: (m) => set({ currentMeeting: m }),
  setParticipants: (p) => set({ participants: p }),
  addParticipant: (p) => set((s) => ({ participants: [...s.participants.filter(x => x.socketId !== p.socketId), p] })),
  removeParticipant: (socketId) => set((s) => ({ participants: s.participants.filter(p => p.socketId !== socketId) })),
  updateParticipant: (socketId, data) => set((s) => ({
    participants: s.participants.map(p => p.socketId === socketId ? { ...p, ...data } : p)
  })),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleVideo: () => set((s) => ({ isVideoOff: !s.isVideoOff })),
  setScreenSharing: (v) => set({ isScreenSharing: v }),
  toggleScreenShare: () => set((s) => ({ isScreenSharing: !s.isScreenSharing })),
  toggleRecording: () => set((s) => ({ isRecording: !s.isRecording })),
  setInCall: (v) => set({ isInCall: v }),
  resetMeeting: () => set({ currentMeeting: null, participants: [], isMuted: false, isVideoOff: false, isScreenSharing: false, isRecording: false, isInCall: false }),
}));
