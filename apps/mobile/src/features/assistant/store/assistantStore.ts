import { create } from 'zustand';
import { storage } from '@/shared/services/storage';
import { STORAGE_KEYS } from '@/shared/constants';
import type { AssistantMessage } from '../types';

export type AssistantToolProgress = {
  toolName: string;
  message: string;
} | null;

type AssistantState = {
  open: boolean;
  voiceMode: boolean;
  conversationId: string | null;
  responseId: string | null;
  currentScreen: string | null;
  messages: AssistantMessage[];
  toolProgress: AssistantToolProgress;
  quickActions: string[];
  sending: boolean;
  enabled: boolean;
  offlineQueue: Array<{ message: string; conversationId?: string }>;
};

type AssistantActions = {
  openAssistant: (opts?: { voiceMode?: boolean }) => void;
  closeAssistant: () => void;
  setCurrentScreen: (screen: string | null) => void;
  setConversationId: (id: string | null) => void;
  setResponseId: (id: string | null) => void;
  addMessage: (message: AssistantMessage) => void;
  updateLastAssistant: (patch: Partial<AssistantMessage>) => void;
  setToolProgress: (progress: AssistantToolProgress) => void;
  setQuickActions: (actions: string[]) => void;
  setSending: (sending: boolean) => void;
  clearMessages: () => void;
  setEnabled: (enabled: boolean) => void;
  enqueueOffline: (item: { message: string; conversationId?: string }) => void;
  dequeueOffline: () => { message: string; conversationId?: string } | undefined;
  drainOfflineQueue: () => Array<{ message: string; conversationId?: string }>;
};

function loadEnabled(): boolean {
  const raw = storage.getString(STORAGE_KEYS.ASSISTANT_ENABLED);
  return raw !== 'false';
}

function loadOfflineQueue(): AssistantState['offlineQueue'] {
  const raw = storage.getString(STORAGE_KEYS.ASSISTANT_OFFLINE_QUEUE);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AssistantState['offlineQueue'];
  } catch {
    return [];
  }
}

function persistOfflineQueue(queue: AssistantState['offlineQueue']) {
  storage.set(STORAGE_KEYS.ASSISTANT_OFFLINE_QUEUE, JSON.stringify(queue));
}

export const useAssistantStore = create<AssistantState & AssistantActions>((set, get) => ({
  open: false,
  voiceMode: false,
  conversationId: null,
  responseId: null,
  currentScreen: null,
  messages: [],
  toolProgress: null,
  quickActions: [],
  sending: false,
  enabled: loadEnabled(),
  offlineQueue: loadOfflineQueue(),

  openAssistant: opts =>
    set({ open: true, voiceMode: Boolean(opts?.voiceMode) }),
  closeAssistant: () => set({ open: false, voiceMode: false, toolProgress: null }),
  setCurrentScreen: screen => set({ currentScreen: screen }),
  setConversationId: id => set({ conversationId: id }),
  setResponseId: id => set({ responseId: id }),
  addMessage: message =>
    set(state => ({ messages: [...state.messages, message] })),
  updateLastAssistant: patch =>
    set(state => {
      const messages = [...state.messages];
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'assistant') {
          messages[i] = { ...messages[i], ...patch };
          break;
        }
      }
      return { messages };
    }),
  setToolProgress: toolProgress => set({ toolProgress }),
  setQuickActions: quickActions => set({ quickActions }),
  setSending: sending => set({ sending }),
  clearMessages: () => set({ messages: [], conversationId: null, responseId: null }),
  setEnabled: enabled => {
    storage.set(STORAGE_KEYS.ASSISTANT_ENABLED, enabled ? 'true' : 'false');
    set({ enabled });
  },
  enqueueOffline: item => {
    const queue = [...get().offlineQueue, item];
    persistOfflineQueue(queue);
    set({ offlineQueue: queue });
  },
  dequeueOffline: () => {
    const [first, ...rest] = get().offlineQueue;
    persistOfflineQueue(rest);
    set({ offlineQueue: rest });
    return first;
  },
  drainOfflineQueue: () => {
    const queue = get().offlineQueue;
    persistOfflineQueue([]);
    set({ offlineQueue: [] });
    return queue;
  },
}));
