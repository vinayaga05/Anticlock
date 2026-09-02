import {
  attachVoiceHandlers,
  classifySpeechError,
  commitSegment,
  formatTranscript,
  shouldFireSilenceTimeout,
  speechErrorMessage,
} from '../utils/voiceSession';

describe('voiceSession helpers', () => {
  it('formats base and current transcript segments', () => {
    expect(formatTranscript('hello', 'world')).toBe('hello world');
    expect(formatTranscript('', 'world')).toBe('world');
    expect(formatTranscript('hello', '')).toBe('hello');
  });

  it('commits segments into accumulated transcript', () => {
    expect(commitSegment('find reels', 'about travel')).toBe('find reels about travel');
  });

  it('fires silence timeout after grace when no speech heard', () => {
    const startedAt = 1000;
    expect(
      shouldFireSilenceTimeout(1800, null, startedAt, 2000, 800, false),
    ).toBe(false);
    expect(
      shouldFireSilenceTimeout(3801, null, startedAt, 2000, 800, false),
    ).toBe(true);
  });

  it('fires silence timeout after last speech activity', () => {
    const lastActivity = 5000;
    expect(
      shouldFireSilenceTimeout(6500, lastActivity, 1000, 2000, 800, true),
    ).toBe(false);
    expect(
      shouldFireSilenceTimeout(7001, lastActivity, 1000, 2000, 800, true),
    ).toBe(true);
  });

  it('classifies permission errors', () => {
    expect(classifySpeechError('User denied access to speech recognition')).toBe(
      'permission',
    );
    expect(speechErrorMessage('permission')).toMatch(/Microphone access/);
  });
});

describe('attachVoiceHandlers', () => {
  it('does not stop listening on partial or results events alone', () => {
    const onDone = jest.fn();
    const mod: Record<string, unknown> = {};

    attachVoiceHandlers(mod as never, {
      onPartial: jest.fn(),
      onResult: jest.fn(),
      onFinalSegment: jest.fn(),
      onEnd: onDone,
      onError: jest.fn(),
      onVolume: jest.fn(),
    });

    (mod.onSpeechPartialResults as (e: { value: string[] }) => void)({
      value: ['hello'],
    });
    (mod.onSpeechResults as (e: { value: string[] }) => void)({
      value: ['hello there'],
    });

    expect(onDone).not.toHaveBeenCalled();
  });

  it('signals end only from onSpeechEnd', () => {
    const onDone = jest.fn();
    const mod: Record<string, unknown> = {};

    attachVoiceHandlers(mod as never, {
      onPartial: jest.fn(),
      onResult: jest.fn(),
      onFinalSegment: jest.fn(),
      onEnd: onDone,
      onError: jest.fn(),
      onVolume: jest.fn(),
    });

    (mod.onSpeechEnd as () => void)();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
