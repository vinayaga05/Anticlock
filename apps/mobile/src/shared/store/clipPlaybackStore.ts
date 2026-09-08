import { create } from 'zustand';

type SeekToTime = (seconds: number) => void;

type ClipPlaybackState = {
  activeClipId: string | null;
  currentTime: number;
  duration: number;
  seekToTime: SeekToTime | null;
  setActiveClip: (clipId: string | null) => void;
  updateProgress: (
    clipId: string,
    currentTime: number,
    duration: number,
  ) => void;
  registerSeekController: (
    clipId: string,
    seekToTime: SeekToTime | null,
  ) => void;
  seekToRatio: (ratio: number) => void;
  clear: () => void;
};

const emptyPlayback = {
  activeClipId: null,
  currentTime: 0,
  duration: 0,
  seekToTime: null,
};

/**
 * Bridges the active Clip player with the full-screen navigation overlay.
 * The callback never leaves the device and is cleared whenever its player
 * unmounts, so an old Clip cannot be scrubbed after the user moves away.
 */
export const useClipPlaybackStore = create<ClipPlaybackState>((set, get) => ({
  ...emptyPlayback,

  setActiveClip: clipId =>
    set(state => {
      if (state.activeClipId === clipId) return state;
      return clipId
        ? {
            activeClipId: clipId,
            currentTime: 0,
            duration: 0,
            seekToTime: null,
          }
        : emptyPlayback;
    }),

  updateProgress: (clipId, currentTime, duration) =>
    set(state => ({
      activeClipId: clipId,
      currentTime: Math.max(0, Math.min(currentTime, duration)),
      duration: Math.max(0, duration),
      seekToTime: state.activeClipId === clipId ? state.seekToTime : null,
    })),

  registerSeekController: (clipId, seekToTime) =>
    set(state => {
      if (seekToTime === null && state.activeClipId !== clipId) return state;
      return {
        activeClipId: clipId,
        seekToTime,
      };
    }),

  seekToRatio: ratio => {
    const { duration, seekToTime } = get();
    if (!seekToTime || duration <= 0) return;
    const target = Math.min(1, Math.max(0, ratio)) * duration;
    seekToTime(target);
    set({ currentTime: target });
  },

  clear: () => set(emptyPlayback),
}));
