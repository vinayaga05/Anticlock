import { apiRequest, apiStream, setApiToken, setUnauthorizedHandler } from './client';
jest.mock('./config', () => ({ isApiEnabled: true, getApiBaseUrl: () => 'https://api.example.test' }));
const originalFetch = global.fetch; const originalXhr = global.XMLHttpRequest;
const unauthorized = jest.fn();
beforeEach(() => { unauthorized.mockClear(); setApiToken('old-session'); setUnauthorizedHandler(unauthorized); });
afterEach(() => { global.fetch = originalFetch; global.XMLHttpRequest = originalXhr; setApiToken(null); setUnauthorizedHandler(null); });

test.each([false, true])('JSON unauthorized response only expires its own session (switched=%s)', async switched => {
  let finish!: (value: unknown) => void;
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', json: () => new Promise(resolve => { finish = resolve; }) });
  const request = apiRequest('/business'); const rejected = expect(request).rejects.toMatchObject({ status: 401 });
  await Promise.resolve();
  if (switched) setApiToken('new-session');
  finish({ error: { code: 'unauthorized', message: 'Expired' } }); await rejected;
  expect(unauthorized).toHaveBeenCalledTimes(switched ? 0 : 1);
});
test('an anonymous request cannot expire a session established while it was pending', async () => {
  setApiToken(null); let finish!: (value: unknown) => void;
  global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const request = apiRequest('/business'); const rejected = expect(request).rejects.toMatchObject({ status: 401 });
  setApiToken('new-session'); finish({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) }); await rejected;
  expect(unauthorized).not.toHaveBeenCalled();
});
test.each([false, true])('stream unauthorized response only expires its own session (switched=%s)', async switched => {
  let xhr: any;
  global.XMLHttpRequest = class {
    status = 401; statusText = 'Unauthorized'; responseText = '{}';
    onload!: () => void; onprogress!: () => void; onerror!: () => void; onabort!: () => void;
    constructor() { xhr = this; }
    open() {} setRequestHeader() {} send() {} abort() { this.onabort?.(); }
  } as any;
  const request = apiStream('/stream', {}, () => {}); const rejected = expect(request).rejects.toMatchObject({ status: 401 });
  if (switched) setApiToken('new-session'); xhr.onload(); await rejected;
  expect(unauthorized).toHaveBeenCalledTimes(switched ? 0 : 1);
});
