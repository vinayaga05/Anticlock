export function formatTranscript(base: string, current: string): string {
  const b = base.trim();
  const c = current.trim();
  if (!b) return c;
  if (!c) return b;
  return `${b} ${c}`;
}

export function commitSegment(base: string, segment: string): string {
  return formatTranscript(base, segment);
}

export function shouldFireSilenceTimeout(
  now: number,
  lastActivityAt: number | null,
  sessionStartedAt: number,
  silenceTimeoutMs: number,
  startGraceMs: number,
  hasHeardSpeech: boolean,
): boolean {
  if (hasHeardSpeech) {
    if (lastActivityAt == null) return false;
    return now - lastActivityAt >= silenceTimeoutMs;
  }

  if (now - sessionStartedAt < startGraceMs) return false;
  const idleSince = lastActivityAt ?? sessionStartedAt;
  return now - idleSince >= silenceTimeoutMs;
}

export type SpeechErrorKind =
  | 'permission'
  | 'network'
  | 'no_match'
  | 'busy'
  | 'unavailable'
  | 'unknown';

/**
 * Normalize Voice module errors. Android often sends bare codes ("7") or
 * "7/No match" — those must not surface as hard failures while listening.
 */
export function classifySpeechError(message: string): SpeechErrorKind {
  const lower = message.toLowerCase().trim();
  const codeMatch = lower.match(/(?:^|\/|\s)(\d{1,2})(?:\/|$|\s)/);
  const code = codeMatch ? Number(codeMatch[1]) : NaN;

  if (
    lower.includes('denied') ||
    lower.includes('not authorized') ||
    lower.includes('permission') ||
    lower.includes('insufficient permissions') ||
    code === 9
  ) {
    return 'permission';
  }
  if (lower.includes('network') || code === 1 || code === 2) {
    return 'network';
  }
  if (
    lower.includes('no match') ||
    lower.includes('no speech') ||
    lower.includes('speech timeout') ||
    lower.includes('error_no_match') ||
    lower.includes('error_speech_timeout') ||
    lower.includes('didn\'t catch') ||
    lower.includes('did not understand') ||
    code === 6 ||
    code === 7
  ) {
    return 'no_match';
  }
  if (
    lower.includes('busy') ||
    lower.includes('recognizer_busy') ||
    lower.includes('client side error') ||
    lower.includes('error_client') ||
    code === 5 ||
    code === 8
  ) {
    return 'busy';
  }
  if (
    lower.includes('not available') ||
    lower.includes('recognition service') ||
    code === 11
  ) {
    return 'unavailable';
  }
  return 'unknown';
}

/** Transient recognizer failures — keep the listening session alive. */
export function isBenignSpeechError(kind: SpeechErrorKind): boolean {
  return kind === 'no_match' || kind === 'busy';
}

export function speechErrorMessage(kind: SpeechErrorKind): string {
  switch (kind) {
    case 'permission':
      return 'Microphone access is required for voice input.';
    case 'network':
      return 'Network error. Check your connection and try again.';
    case 'no_match':
      return "Couldn't hear you. Try again.";
    case 'busy':
      return 'Voice is busy. Try again in a moment.';
    case 'unavailable':
      return 'Speech recognition is not available on this device.';
    default:
      return "Couldn't hear you. Try again.";
  }
}

export type VoiceEventHandlers = {
  onPartial: (text: string) => void;
  onResult: (text: string) => void;
  onFinalSegment: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
  onVolume: () => void;
};

type VoiceEventModule = {
  onSpeechResults: (e: { value?: string[] }) => void;
  onSpeechPartialResults: (e: { value?: string[] }) => void;
  onSpeechError: (e: { error?: { message?: string; code?: string } }) => void;
  onSpeechEnd: (e?: { error?: boolean }) => void;
  onSpeechStart: (e?: { error?: boolean }) => void;
  onSpeechRecognized: (e: { isFinal?: boolean }) => void;
  onSpeechVolumeChanged: (e: { value?: number }) => void;
};

/** Assign @react-native-voice/voice callbacks (property setters, not methods). */
export function attachVoiceHandlers(mod: VoiceEventModule, handlers: VoiceEventHandlers) {
  mod.onSpeechPartialResults = e => {
    const text = e.value?.[0] ?? '';
    if (text) handlers.onPartial(text);
  };
  mod.onSpeechResults = e => {
    const text = e.value?.[0] ?? '';
    if (text) handlers.onResult(text);
  };
  mod.onSpeechRecognized = e => {
    if (e.isFinal) handlers.onFinalSegment();
  };
  mod.onSpeechEnd = () => handlers.onEnd();
  mod.onSpeechError = e => {
    const message = e.error?.message ?? e.error?.code ?? 'Speech recognition failed';
    handlers.onError(String(message));
  };
  mod.onSpeechVolumeChanged = () => handlers.onVolume();
  mod.onSpeechStart = () => undefined;
}
