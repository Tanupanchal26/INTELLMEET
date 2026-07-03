import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { STORAGE_KEYS } from '../../constants';

type Theme = 'dark' | 'light' | 'system';
type Density = 'comfortable' | 'compact';
type Panel = 'chat' | 'participants' | 'ai' | 'notes';

interface UIState {
  theme: Theme;
  density: Density;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  activeMeetingPanel: Panel;
  globalLoading: boolean;
}

const initialState: UIState = {
  theme: (localStorage.getItem(STORAGE_KEYS.THEME) as Theme) || 'light',
  density: (localStorage.getItem(STORAGE_KEYS.DENSITY) as Density) || 'comfortable',
  sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.SIDEBAR) === 'true',
  mobileSidebarOpen: false,
  activeMeetingPanel: 'chat',
  globalLoading: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, { payload }: PayloadAction<Theme>) {
      state.theme = payload;
      localStorage.setItem(STORAGE_KEYS.THEME, payload);
    },
    toggleTheme(state) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEYS.THEME, state.theme);
    },
    setDensity(state, { payload }: PayloadAction<Density>) {
      state.density = payload;
      localStorage.setItem(STORAGE_KEYS.DENSITY, payload);
    },
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      localStorage.setItem(STORAGE_KEYS.SIDEBAR, String(state.sidebarCollapsed));
    },
    setMobileSidebar(state, { payload }: PayloadAction<boolean>) {
      state.mobileSidebarOpen = payload;
    },
    setActiveMeetingPanel(state, { payload }: PayloadAction<Panel>) {
      state.activeMeetingPanel = payload;
    },
    setGlobalLoading(state, { payload }: PayloadAction<boolean>) {
      state.globalLoading = payload;
    },
  },
});

export const { setTheme, toggleTheme, setDensity, toggleSidebar, setMobileSidebar, setActiveMeetingPanel, setGlobalLoading } = uiSlice.actions;
export default uiSlice.reducer;
