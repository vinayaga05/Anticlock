import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  Vibration,
} from 'react-native';
import {
  VOICE_ERROR_CLEAR_MS,
  VOICE_LOCALE,
  VOICE_SESSION_RESTART_MS,
  VOICE_SILENCE_TIMEOUT_MS,
  VOICE_START_GRACE_MS,
} from '@/features/assistant/constants/voice';
import {
  attachVoiceHandlers,
  classifySpeechError,
  commitSegment,
  formatTranscript,
  isBenignSpeechError,
  shouldFireSilenceTimeout,
  speechErrorMessage,
} from '@/features/assistant/utils/voiceSession';

export type VoiceInputState =
  | 'idle'
  | 'listening'
  | 'confirm'
  | 'processing'
  | 'error'
  | 'unavailable'
  | 'permission_denied';

type AndroidStartOptions = {
  EXTRA_LANGUAGE_MODEL?: string;
  EXTRA_MAX_RESULTS?: number;
  EXTRA_PARTIAL_RESULTS?: boolean;
  EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS?: number;
  EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS?: number;
  EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS?: number;
  REQUEST_PERMISSIONS_AUTO?: boolean;
};

type VoiceModule = {
  isAvailable: () => Promise<boolean | 0 | 1>;
  start: (locale: string, options?: AndroidStartOptions) => Promise<unknown>;
  stop: () => Promise<unknown>;
  cancel: () => Promise<unknown>;
  destroy: () => Promise<unknown>;
  removeAllListeners: () => void;
  onSpeechResults: (e: { value?: string[] }) => void;
  onSpeechPartialResults: (e: { value?: string[] }) => void;
  onSpeechError: (e: { error?: { message?: string; code?: string } }) => void;
  onSpeechEnd: (e?: { error?: boolean }) => void;
  onSpeechStart: (e?: { error?: boolean }) => void;
  onSpeechRecognized: (e: { isFinal?: boolean }) => void;
  onSpeechVolumeChanged: (e: { value?: number }) => void;
};

let voiceModuleCache: VoiceModule | null | undefined;

function isVoiceModule(value: unknown): value is VoiceModule {
  if (!value || typeof value !== 'object') return false;
  const mod = value as VoiceModule;
  return (
    typeof mod.isAvailable === 'function' &&
    typeof mod.start === 'function' &&
    typeof mod.stop === 'function' &&
    typeof mod.cancel === 'function' &&
    typeof mod.destroy === 'function' &&
    typeof mod.removeAllListeners === 'function'
  );
}

export function getVoiceModuleForTests(): VoiceModule | null {
  return getVoiceModule();
}

export function setVoiceModuleForTests(mod: VoiceModule | null | undefined) {
  voiceModuleCache = mod;
}

/** Avoid loading @react-native-voice/voice unless the native module is linked. */
function getVoiceModule(): VoiceModule | null {
  if (voiceModuleCache !== undefined) return voiceModuleCache;

  if (!NativeModules.Voice) {
    voiceModuleCache = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-voice/voice') as { default?: unknown };
    const candidate = mod.default ?? mod;
    voiceModuleCache = isVoiceModule(candidate) ? candidate : null;
  } catch {
    voiceModuleCache = null;
  }

  return voiceModuleCache;
}

function androidStartOptions(): AndroidStartOptions {
  return {
    EXTRA_PARTIAL_RESULTS: true,
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
    REQUEST_PERMISSIONS_AUTO: true,
  };
}

function hapticPulse() {
  try {
    Vibration.vibrate(10);
  } catch {
    /* optional */
  }
}

type SpeechHandlers = {
  onPartial: (text: string) => void;
  onResult: (text: string) => void;
  onFinalSegment: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
  onVolume: () => void;
};

function bindSpeechHandlers(mod: VoiceModule, handlers: SpeechHandlers) {
  attachVoiceHandlers(mod, handlers);
}

export function useSpeechRecognition(options?: {
  onTranscriptChange?: (text: string) => void;
  onStateChange?: (state: VoiceInputState) => void;
  sending?: boolean;
}) {
  const [state, setState] = useState<VoiceInputState>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  const voice = useMemo(() => getVoiceModule(), []);
  const stateRef = useRef(state);
  const listeningIntentRef = useRef(false);
  const committedRef = useRef('');
  const segmentRef = useRef('');
  const sessionStartedAtRef = useRef<number | null>(null);
  const lastActivityAtRef = useRef<number | null>(null);
  const hasHeardSpeechRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingRef = useRef(false);
  const onTranscriptChangeRef = useRef(options?.onTranscriptChange);
  const onStateChangeRef = useRef(options?.onStateChange);

  useEffect(() => {
    onTranscriptChangeRef.current = options?.onTranscriptChange;
    onStateChangeRef.current = options?.onStateChange;
  });

  const updateState = useCallback((next: VoiceInputState) => {
    stateRef.current = next;
    setState(next);
    onStateChangeRef.current?.(next);
  }, []);

  const publishTranscript = useCallback((base: string, segment: string) => {
    const next = formatTranscript(base, segment);
    setTranscript(next);
    onTranscriptChangeRef.current?.(next);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const markActivity = useCallback(() => {
    hasHeardSpeechRef.current = true;
    lastActivityAtRef.current = Date.now();
  }, []);

  const commitCurrentSegment = useCallback(() => {
    if (!segmentRef.current.trim()) return;
    committedRef.current = commitSegment(committedRef.current, segmentRef.current);
    segmentRef.current = '';
    publishTranscript(committedRef.current, '');
  }, [publishTranscript]);

  const showError = useCallback(
    (message: string, kind: ReturnType<typeof classifySpeechError>) => {
      setErrorMessage(message);
      updateState(kind === 'permission' ? 'permission_denied' : 'error');
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        setErrorMessage(null);
        if (stateRef.current === 'error' || stateRef.current === 'permission_denied') {
          updateState('idle');
        }
      }, VOICE_ERROR_CLEAR_MS);
    },
    [updateState],
  );

  const internalStopEngine = useCallback(async (cancel: boolean) => {
    const mod = getVoiceModule();
    if (!mod) return;
    try {
      if (cancel) await mod.cancel();
      else await mod.stop();
    } catch {
      /* ignore */
    }
  }, []);

  const finishListening = useCallback(
    async (commit: boolean) => {
      listeningIntentRef.current = false;
      clearSilenceTimer();
      clearRestartTimer();
      await internalStopEngine(false);
      commitCurrentSegment();
      const finalText = committedRef.current.trim();
      committedRef.current = '';
      segmentRef.current = '';
      sessionStartedAtRef.current = null;
      lastActivityAtRef.current = null;
      hasHeardSpeechRef.current = false;

      if (commit && finalText) {
        setTranscript(finalText);
        onTranscriptChangeRef.current?.(finalText);
        updateState('confirm');
      } else {
        setTranscript('');
        onTranscriptChangeRef.current?.('');
        updateState('idle');
      }
    },
    [
      clearRestartTimer,
      clearSilenceTimer,
      commitCurrentSegment,
      internalStopEngine,
      updateState,
    ],
  );

  const startSilenceWatcher = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setInterval(() => {
      if (!listeningIntentRef.current || stateRef.current !== 'listening') return;
      const now = Date.now();
      const startedAt = sessionStartedAtRef.current ?? now;
      if (
        shouldFireSilenceTimeout(
          now,
          lastActivityAtRef.current,
          startedAt,
          VOICE_SILENCE_TIMEOUT_MS,
          VOICE_START_GRACE_MS,
          hasHeardSpeechRef.current,
        )
      ) {
        void finishListening(true);
      }
    }, 200);
  }, [clearSilenceTimer, finishListening]);

  const bindAndStartEngine = useCallback(async () => {
    const mod = getVoiceModule();
    if (!mod || !listeningIntentRef.current) return false;

    mod.removeAllListeners();
    bindSpeechHandlers(mod, {
      onPartial: text => {
        if (!listeningIntentRef.current) return;
        segmentRef.current = text;
        markActivity();
        publishTranscript(committedRef.current, segmentRef.current);
      },
      onResult: text => {
        if (!listeningIntentRef.current) return;
        segmentRef.current = text;
        markActivity();
        publishTranscript(committedRef.current, segmentRef.current);
      },
      onFinalSegment: () => {
        if (!listeningIntentRef.current) return;
        commitCurrentSegment();
        markActivity();
      },
      onEnd: () => {
        if (!listeningIntentRef.current) return;
        commitCurrentSegment();
        clearRestartTimer();
        restartTimerRef.current = setTimeout(() => {
          if (!listeningIntentRef.current) return;
          void bindAndStartEngine();
        }, VOICE_SESSION_RESTART_MS);
      },
      onVolume: () => {
        if (!listeningIntentRef.current) return;
        markActivity();
      },
      onError: message => {
        if (!listeningIntentRef.current) return;
        const kind = classifySpeechError(message);
        if (isBenignSpeechError(kind)) {
          clearRestartTimer();
          restartTimerRef.current = setTimeout(() => {
            if (!listeningIntentRef.current) return;
            void bindAndStartEngine();
          }, VOICE_SESSION_RESTART_MS);
          return;
        }
        listeningIntentRef.current = false;
        clearSilenceTimer();
        clearRestartTimer();
        void internalStopEngine(true);
        showError(speechErrorMessage(kind), kind);
      },
    });

    try {
      if (Platform.OS === 'android') {
        await mod.start(VOICE_LOCALE, androidStartOptions());
      } else {
        await mod.start(VOICE_LOCALE);
      }
      return true;
    } catch {
      return false;
    }
  }, [
    clearRestartTimer,
    clearSilenceTimer,
    commitCurrentSegment,
    internalStopEngine,
    markActivity,
    publishTranscript,
    showError,
  ]);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }, []);

  const startListening = useCallback(async () => {
    if (startingRef.current) return false;
    const mod = getVoiceModule();
    if (!mod) {
      updateState('unavailable');
      setErrorMessage('Speech recognition is not available on this device.');
      return false;
    }

    startingRef.current = true;
    try {
      const ok = await requestPermission();
      if (!ok) {
        showError('Microphone access is required for voice input.', 'permission');
        return false;
      }

      listeningIntentRef.current = true;
      committedRef.current = '';
      segmentRef.current = '';
      sessionStartedAtRef.current = Date.now();
      lastActivityAtRef.current = null;
      hasHeardSpeechRef.current = false;
      setErrorMessage(null);
      setTranscript('');
      onTranscriptChangeRef.current?.('');
      updateState('listening');
      hapticPulse();
      startSilenceWatcher();

      const started = await bindAndStartEngine();
      if (!started) {
        listeningIntentRef.current = false;
        clearSilenceTimer();
        showError("Couldn't start listening. Try again.", 'unknown');
        return false;
      }
      return true;
    } finally {
      startingRef.current = false;
    }
  }, [
    bindAndStartEngine,
    clearSilenceTimer,
    requestPermission,
    showError,
    startSilenceWatcher,
    updateState,
  ]);

  const stopListening = useCallback(
    async (commit = true) => {
      if (stateRef.current !== 'listening') return;
      hapticPulse();
      await finishListening(commit);
    },
    [finishListening],
  );

  const cancelListening = useCallback(async () => {
    listeningIntentRef.current = false;
    clearSilenceTimer();
    clearRestartTimer();
    await internalStopEngine(true);
    committedRef.current = '';
    segmentRef.current = '';
    sessionStartedAtRef.current = null;
    lastActivityAtRef.current = null;
    hasHeardSpeechRef.current = false;
    setTranscript('');
    onTranscriptChangeRef.current?.('');
    updateState('idle');
  }, [clearRestartTimer, clearSilenceTimer, internalStopEngine, updateState]);

  const dismissConfirm = useCallback(() => {
    setTranscript('');
    onTranscriptChangeRef.current?.('');
    updateState('idle');
  }, [updateState]);

  /** Leave confirm without wiping the draft (e.g. user started typing). */
  const exitConfirm = useCallback(() => {
    if (stateRef.current === 'confirm') {
      updateState('idle');
    }
  }, [updateState]);

  const reset = useCallback(async () => {
    listeningIntentRef.current = false;
    clearSilenceTimer();
    clearRestartTimer();
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    const mod = getVoiceModule();
    if (mod) {
      mod.removeAllListeners();
      try {
        await mod.cancel();
      } catch {
        /* ignore */
      }
    }
    committedRef.current = '';
    segmentRef.current = '';
    sessionStartedAtRef.current = null;
    lastActivityAtRef.current = null;
    hasHeardSpeechRef.current = false;
    setTranscript('');
    setErrorMessage(null);
    onTranscriptChangeRef.current?.('');
    updateState('idle');
  }, [clearRestartTimer, clearSilenceTimer, updateState]);

  const openSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  useEffect(() => {
    if (!voice) {
      updateState('unavailable');
      return;
    }
    void voice
      .isAvailable()
      .then(result => setAvailable(Boolean(result)))
      .catch(() => setAvailable(false));
    return () => {
      void reset();
      if (voice) {
        voice.removeAllListeners();
        void voice.destroy().catch(() => undefined);
      }
    };
  }, [reset, updateState, voice]);

  useEffect(() => {
    if (options?.sending) {
      if (stateRef.current === 'confirm') updateState('processing');
      return;
    }
    if (stateRef.current === 'processing') updateState('idle');
  }, [options?.sending, updateState]);

  return {
    state,
    transcript,
    errorMessage,
    available: available && Boolean(voice) && state !== 'unavailable',
    listening: state === 'listening',
    isConfirm: state === 'confirm',
    startListening,
    stopListening,
    cancelListening,
    dismissConfirm,
    exitConfirm,
    reset,
    openSettings,
  };
}
