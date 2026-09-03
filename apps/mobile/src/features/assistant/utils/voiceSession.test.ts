import {
  attachVoiceHandlers,
  classifySpeechError,
  commitSegment,
  formatTranscript,
  isBenignSpeechError,
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
      shouldFireSilenceTimeout(1800, null, startedAt, 2800, 2200, false),
    ).toBe(false);
    expect(
      shouldFireSilenceTimeout(6001, null, startedAt, 2800, 2200, false),
    ).toBe(true);
  });

  it('fires silence timeout after last speech activity', () => {
    const lastActivity = 5000;
    expect(
      shouldFireSilenceTimeout(6500, lastActivity, 1000, 2800, 2200, true),
    ).toBe(false);
    expect(
      shouldFireSilenceTimeout(7801, lastActivity, 1000, 2800, 2200, true),
    ).toBe(true);
  });

  it('classifies permission errors', () => {
    expect(classifySpeechError('User denied access to speech recognition')).toBe(
      'permission',
    );
    expect(speechErrorMessage('permission')).toMatch(/Microphone access/);
  });

  it('treats android numeric no-match and busy codes as restartable', () => {
    expect(classifySpeechError('7')).toBe('no_match');
    expect(classifySpeechError('7/No match')).toBe('no_match');
    expect(classifySpeechError('6')).toBe('no_match');
    expect(classifySpeechError('5')).toBe('busy');
    expect(classifySpeechError('8/Recognizer busy')).toBe('busy');
    expect(isBenignSpeechError('no_match')).toBe(true);
    expect(isBenignSpeechError('busy')).toBe(true);
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
