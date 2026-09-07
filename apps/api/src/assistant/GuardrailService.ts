/**
 * Deterministic, low-latency checks that run before user content reaches a
 * provider and after model text is returned. These checks intentionally do
 * not try to replace moderation; they cover the product-specific cases where
 * Genie should stop and ask the user to use a safer path.
 */
import { createHash } from 'node:crypto';

export type GuardrailReason =
  | 'prompt_injection'
  | 'sensitive_data'
  | 'prompt_leak';

export type GuardrailResult =
  | { ok: true }
  | { ok: false; reason: GuardrailReason; message: string };

const INPUT_INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|rules|messages)\b/i,
  /\b(?:reveal|show|print|repeat|dump)\s+(?:your\s+)?(?:system|developer)\s+(?:prompt|instructions)\b/i,
  /\b(?:act as|pretend to be)\b.{0,80}\b(?:without|ignore)\b.{0,80}\b(?:rules|instructions|guardrails)\b/i,
  /\b(?:system|developer)\s+message\s*:/i,
];

const OUTPUT_PROMPT_LEAK_PATTERNS = [
  /\b(?:system|developer)\s+(?:prompt|instructions)\s*:/i,
  /\bavailable screens:\s*(?:-|\n)/i,
  /\bpersona version:\s*\S+/i,
];

const PASSWORD_PATTERN = /\b(?:password|passcode|otp|one[- ]time code)\s*[:=]\s*\S+/i;
const SECRET_ASSIGNMENT_PATTERN = /\b(?:api[-_ ]?key|access token|secret)\s*[:=]\s*\S+/i;
const API_KEY_PATTERN = /\b(?:gsk_[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{10,})\b/;
const AADHAAR_PATTERN = /\b(?:aadhaar|aadhar)\D{0,24}\d(?:[\s-]?\d){11}\b/i;
const CARD_CANDIDATE_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;

function isLikelyCardNumber(candidate: string) {
  const digits = candidate.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function includesCardNumber(value: string) {
  return [...value.matchAll(CARD_CANDIDATE_PATTERN)].some(match =>
    isLikelyCardNumber(match[0]),
  );
}

export function evaluateAssistantInput(value: string): GuardrailResult {
  if (INPUT_INJECTION_PATTERNS.some(pattern => pattern.test(value))) {
    return {
      ok: false,
      reason: 'prompt_injection',
      message:
        'I can help with Anticlock, but I can’t follow requests that change my safety rules or reveal internal instructions.',
    };
  }

  if (
    PASSWORD_PATTERN.test(value) ||
    SECRET_ASSIGNMENT_PATTERN.test(value) ||
    API_KEY_PATTERN.test(value) ||
    AADHAAR_PATTERN.test(value) ||
    includesCardNumber(value)
  ) {
    return {
      ok: false,
      reason: 'sensitive_data',
      message:
        'For your safety, please don’t send passwords, OTPs, card numbers, or identity numbers in Genie. I can still help without them.',
    };
  }

  return { ok: true };
}

export function evaluateAssistantOutput(value: string): GuardrailResult {
  if (OUTPUT_PROMPT_LEAK_PATTERNS.some(pattern => pattern.test(value))) {
    return {
      ok: false,
      reason: 'prompt_leak',
      message:
        'I can help you find services, products, clips, and app features, but I can’t share internal instructions.',
    };
  }
  if (
    PASSWORD_PATTERN.test(value) ||
    SECRET_ASSIGNMENT_PATTERN.test(value) ||
    API_KEY_PATTERN.test(value) ||
    AADHAAR_PATTERN.test(value) ||
    includesCardNumber(value)
  ) {
    return {
      ok: false,
      reason: 'sensitive_data',
      message:
        'I can’t display sensitive credentials or identity information here. Please use the relevant secure account screen instead.',
    };
  }
  return { ok: true };
}

/** A stable one-way fingerprint for trace and analytics correlation. */
export function queryFingerprint(value: string) {
  return `q_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}
