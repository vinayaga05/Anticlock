import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  setVoiceModuleForTests,
  useSpeechRecognition,
} from '../hooks/useSpeechRecognition';
import { VOICE_SILENCE_TIMEOUT_MS, VOICE_START_GRACE_MS } from '../constants/voice';

jest.mock('react-native', () => ({
  NativeModules: { Voice: {} },
  Platform: { OS: 'ios' },
  PermissionsAndroid: {
    PERMISSIONS: { RECORD_AUDIO: 'android.permission.RECORD_AUDIO' },
    RESULTS: { GRANTED: 'granted', DENIED: 'denied' },
    request: jest.fn().mockResolvedValue('granted'),
  },
  Vibration: { vibrate: jest.fn() },
  Linking: { openSettings: jest.fn().mockResolvedValue(undefined) },
}));

function createMockVoiceModule() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  const mod = {
    isAvailable: jest.fn().mockResolvedValue(1),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    removeAllListeners: jest.fn(),
    emitPartial: (text: string) => handlers.onSpeechPartialResults?.({ value: [text] }),
    emitResults: (text: string) => handlers.onSpeechResults?.({ value: [text] }),
    emitEnd: () => handlers.onSpeechEnd?.({}),
    emitError: (message: string) => handlers.onSpeechError?.({ error: { message } }),
  };

  for (const key of [
    'onSpeechPartialResults',
    'onSpeechResults',
    'onSpeechError',
    'onSpeechEnd',
    'onSpeechStart',
    'onSpeechRecognized',
    'onSpeechVolumeChanged',
  ]) {
    Object.defineProperty(mod, key, {
      set(fn: (...args: unknown[]) => void) {
        handlers[key] = fn;
      },
      get() {
        return handlers[key];
      },
    });
  }

  return mod;
}

function renderSpeechHook(options?: Parameters<typeof useSpeechRecognition>[0]) {
  const ref: { current: ReturnType<typeof useSpeechRecognition> | null } = { current: null };

  function Probe() {
    ref.current = useSpeechRecognition(options);
    return null;
  }

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Probe));
  });

  return {
    get current() {
      return ref.current!;
    },
    unmount() {
      act(() => renderer.unmount());
    },
  };
}

describe('useSpeechRecognition', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setVoiceModuleForTests(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    setVoiceModuleForTests(undefined);
  });

  it('stays listening across partial and results events', async () => {
    const mock = createMockVoiceModule();
    setVoiceModuleForTests(mock as never);
    const onTranscriptChange = jest.fn();
    const probe = renderSpeechHook({ onTranscriptChange });

    await act(async () => {
      await probe.current.startListening();
    });

    expect(probe.current.listening).toBe(true);

    act(() => {
      mock.emitPartial('hello');
      mock.emitResults('hello there');
    });

    expect(probe.current.listening).toBe(true);
    expect(onTranscriptChange).toHaveBeenCalledWith('hello there');

    probe.unmount();
  });

  it('moves to confirm with transcript when stopped', async () => {
    const mock = createMockVoiceModule();
    setVoiceModuleForTests(mock as never);
    const probe = renderSpeechHook();

    await act(async () => {
      await probe.current.startListening();
    });

    act(() => {
      mock.emitPartial('book a lab test');
    });

    await act(async () => {
      await probe.current.stopListening(true);
    });

    expect(probe.current.isConfirm).toBe(true);
    expect(probe.current.transcript).toBe('book a lab test');
    expect(mock.stop).toHaveBeenCalled();

    probe.unmount();
  });

  it('auto-stops after silence timeout and enters confirm', async () => {
    const mock = createMockVoiceModule();
    setVoiceModuleForTests(mock as never);
    const probe = renderSpeechHook();

    await act(async () => {
      await probe.current.startListening();
    });

    act(() => {
      mock.emitPartial('find doctors');
    });

    await act(async () => {
      jest.advanceTimersByTime(VOICE_START_GRACE_MS + VOICE_SILENCE_TIMEOUT_MS + 300);
    });

    expect(probe.current.isConfirm).toBe(true);
    expect(probe.current.transcript).toBe('find doctors');

    probe.unmount();
  });

  it('cancel clears transcript and returns to idle', async () => {
    const mock = createMockVoiceModule();
    setVoiceModuleForTests(mock as never);
    const onTranscriptChange = jest.fn();
    const probe = renderSpeechHook({ onTranscriptChange });

    await act(async () => {
      await probe.current.startListening();
    });

    act(() => {
      mock.emitPartial('ignore this');
    });

    await act(async () => {
      await probe.current.cancelListening();
    });

    expect(probe.current.state).toBe('idle');
    expect(probe.current.transcript).toBe('');
    expect(onTranscriptChange).toHaveBeenLastCalledWith('');
    expect(mock.cancel).toHaveBeenCalled();

    probe.unmount();
  });

  it('surfaces permission errors', async () => {
    const mock = createMockVoiceModule();
    setVoiceModuleForTests(mock as never);
    const probe = renderSpeechHook();

    await act(async () => {
      await probe.current.startListening();
    });

    act(() => {
      mock.emitError('User denied access to speech recognition');
    });

    expect(probe.current.state).toBe('permission_denied');
    expect(probe.current.errorMessage).toMatch(/Microphone access/);

    probe.unmount();
  });
});
