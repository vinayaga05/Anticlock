import { ApiOtpProvider, createOtpProvider } from './otpProvider';
import { DevOtpProvider } from './devOtpProvider';

const mockRequest = jest.fn();
let mockToken: string | null = null;
let mockEnabled = true;
jest.mock('@/shared/api/client', () => ({
  apiRequest: (...args: any[]) => mockRequest(...args),
  getApiToken: () => mockToken,
}));
jest.mock('@/shared/api/config', () => ({
  get isApiEnabled() {
    return mockEnabled;
  },
}));
jest.mock('./otpInstallation', () => ({
  getOtpInstallationId: () => 'otp-test-installation',
}));
const phone = '+919876543210';
const challenge = {
  requestId: '73589432-dc9c-4c67-babb-e72b1a020547',
  expiresInSeconds: 300,
  expiresAt: '2099-01-01T00:05:00Z',
  resendAvailableAt: '2099-01-01T00:01:00Z',
};
const session = {
  token: 'server-issued-token',
  expiresAt: '2099-02-01T00:00:00Z',
  user: { id: 'user-1', phone, displayName: 'Member' },
};
const provider = new ApiOtpProvider();
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(yes => {
    resolve = yes;
  });
  return { resolve, promise };
}
beforeEach(() => {
  mockRequest.mockReset();
  mockToken = null;
  mockEnabled = true;
});
afterEach(() => jest.useRealTimers());

test('sends canonical phone and installation context to the existing backend', async () => {
  mockRequest.mockResolvedValue(challenge);
  await expect(provider.sendOtp('9876543210')).resolves.toEqual(challenge);
  expect(mockRequest).toHaveBeenCalledWith('/auth/mobile/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone, deviceId: 'otp-test-installation' }),
    signal: expect.any(AbortSignal),
  });
});

test('verification sends the code to the backend and accepts only a matching server identity', async () => {
  mockRequest.mockResolvedValue(session);
  await expect(
    provider.verifyOtp(phone, '567890', challenge.requestId),
  ).resolves.toEqual(session);
  expect(JSON.parse(mockRequest.mock.calls[0][1].body)).toEqual({
    phone,
    code: '567890',
    requestId: challenge.requestId,
    deviceId: 'otp-test-installation',
  });
  mockRequest.mockResolvedValue({
    ...session,
    user: { ...session.user, phone: '+919000000000' },
  });
  await expect(
    provider.verifyOtp(phone, '567890', challenge.requestId),
  ).rejects.toMatchObject({ code: 'invalid_response' });
});

test('no code or session is fabricated when the API is disabled, including the legacy development export', async () => {
  expect(createOtpProvider()).toBeInstanceOf(ApiOtpProvider);
  mockEnabled = false;
  await expect(createOtpProvider().sendOtp('9999999999')).rejects.toMatchObject(
    { code: 'api_disabled' },
  );
  await expect(
    new DevOtpProvider().verifyOtp('9999999999', '123456', challenge.requestId),
  ).rejects.toMatchObject({ code: 'api_disabled' });
  expect(mockRequest).not.toHaveBeenCalled();
});

test('validates numbers and numeric codes before any request', async () => {
  await expect(provider.sendOtp('449876543210')).rejects.toMatchObject({
    code: 'invalid_phone',
  });
  await expect(
    provider.verifyOtp(phone, 'abcdef', challenge.requestId),
  ).rejects.toMatchObject({ code: 'invalid_otp' });
  expect(mockRequest).not.toHaveBeenCalled();
});

test('rejects a send response without confirmed server timing', async () => {
  mockRequest.mockResolvedValue({
    requestId: challenge.requestId,
    expiresInSeconds: 300,
  });
  await expect(provider.sendOtp(phone)).rejects.toMatchObject({
    code: 'invalid_response',
  });
});

test.each([
  null,
  { ...challenge, expiresInSeconds: Infinity },
  { ...challenge, requestId: 'invalid' },
])('rejects a malformed accepted-send response', async response => {
  mockRequest.mockResolvedValue(response);
  await expect(provider.sendOtp(phone)).rejects.toMatchObject({
    code: 'invalid_response',
  });
});

test('whole-response timeout aborts a transport/body stall and cannot accept a late response', async () => {
  jest.useFakeTimers();
  const pending = deferred();
  mockRequest.mockReturnValue(pending.promise);
  const result = provider.sendOtp(phone);
  const rejected = expect(result).rejects.toMatchObject({
    code: 'request_timeout',
  });
  const signal = mockRequest.mock.calls[0][1].signal;
  jest.advanceTimersByTime(25_000);
  await rejected;
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  pending.resolve(challenge);
  await Promise.resolve();
  expect(mockRequest).toHaveBeenCalledTimes(1);
});

test.each(['cancelled', 'account-switch', 'replaced-attempt'])(
  'a late response is rejected after %s',
  async reason => {
    const pending = deferred();
    mockRequest.mockReturnValue(pending.promise);
    const abort = new AbortController();
    let current = true;
    const result = provider.sendOtp(phone, {
      signal: abort.signal,
      isCurrentAttempt: () => current,
    });
    const rejected = expect(result).rejects.toMatchObject({
      code: 'otp_cancelled',
    });
    if (reason === 'cancelled') abort.abort();
    if (reason === 'account-switch') mockToken = 'another-session';
    if (reason === 'replaced-attempt') current = false;
    pending.resolve(challenge);
    await rejected;
  },
);

test('current provider failures remain actionable and requests never retry automatically', async () => {
  const error = Object.assign(
    new Error('Please wait before requesting another code.'),
    { code: 'rate_limit_exceeded', retryAfterSeconds: 60 },
  );
  mockRequest.mockRejectedValue(error);
  await expect(provider.sendOtp(phone)).rejects.toBe(error);
  expect(mockRequest).toHaveBeenCalledTimes(1);
});
