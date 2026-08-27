import { create } from 'zustand';
import { ThemeMode } from '@/shared/types';
import {
  getStoredThemeMode,
  setStoredThemeMode,
} from '@/shared/services/storage';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>(set => ({
  mode: getStoredThemeMode(),
  setMode: mode => {
    setStoredThemeMode(mode);
    set({ mode });
  },
}));
