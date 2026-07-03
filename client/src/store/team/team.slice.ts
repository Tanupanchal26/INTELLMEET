import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { teamService, type Team, type Channel } from '../../api/team.api';

interface TeamState {
  teams: Team[];
  activeTeam: Team | null;
  channels: Channel[];
  activeChannelId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: TeamState = {
  teams: [],
  activeTeam: null,
  channels: [],
  activeChannelId: null,
  loading: false,
  error: null,
};

export const fetchTeams = createAsyncThunk('teams/fetchAll', () =>
  teamService.list().then((r: any) => r.data as Team[])
);

export const fetchTeam = createAsyncThunk('teams/fetchOne', (id: string) =>
  teamService.getById(id).then((r: any) => r.data as Team)
);

export const fetchChannels = createAsyncThunk('teams/fetchChannels', (teamId: string) =>
  teamService.listChannels(teamId).then((r: any) => r.data as Channel[])
);

export const createTeam = createAsyncThunk('teams/create', (data: Partial<Team>) =>
  teamService.create(data).then((r: any) => r.data as Team)
);

const teamSlice = createSlice({
  name: 'teams',
  initialState,
  reducers: {
    setActiveTeam: (state, action: PayloadAction<Team | null>) => {
      state.activeTeam = action.payload;
      state.activeChannelId = null;
    },
    setActiveChannel: (state, action: PayloadAction<string>) => {
      state.activeChannelId = action.payload;
    },
    addChannel: (state, action: PayloadAction<Channel>) => {
      state.channels.push(action.payload);
    },
    updateChannelLastMessage: (state, action: PayloadAction<{ channelId: string; time: string }>) => {
      const ch = state.channels.find(c => c._id === action.payload.channelId);
      if (ch) ch.lastMessageAt = action.payload.time;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeams.pending,    (s) => { s.loading = true; s.error = null; })
      .addCase(fetchTeams.fulfilled,  (s, a) => { s.loading = false; s.teams = a.payload; })
      .addCase(fetchTeams.rejected,   (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; })
      .addCase(fetchTeam.fulfilled,   (s, a) => { s.activeTeam = a.payload; })
      .addCase(fetchChannels.fulfilled,(s, a) => { s.channels = a.payload; })
      .addCase(createTeam.fulfilled,  (s, a) => { s.teams.unshift(a.payload); });
  },
});

export const { setActiveTeam, setActiveChannel, addChannel, updateChannelLastMessage } = teamSlice.actions;
export default teamSlice.reducer;
