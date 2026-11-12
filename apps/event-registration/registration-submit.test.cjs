const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .find(source => source.includes('// Global Application State'));
assert.ok(script, 'the registration page contains its application script');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const uploaded = {
  storage: 'r2',
  bucket: 'anticlock-private-documents',
  key: 'registration/9000000000/test-proof.png',
  screenshotUrl: 'https://images.example.test/signed-proof',
};
const savedRecord = {
  fullName: 'Test Participant', age: 28, gender: 'Female',
  email: 'participant@example.test', mobile: '9000000000', category: 'Student',
  quantity: 1, unitPrice: 149, totalAmount: 149, transactionId: '123456789012',
  regId: 'ACHFA-2026-1234', screenshotUrl: uploaded.screenshotUrl,
};
const snapshot = value => ({ exists: () => value !== null, val: () => value });
const never = () => new Promise(() => {});
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(options = {}) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set(['step1Section', 'step3Section', 'customDialog'].includes(id) ? ['hidden'] : []);
      elements.set(id, {
        value: '', textContent: '', innerHTML: '', className: '', disabled: false, style: {},
        classList: {
          add: (...items) => items.forEach(item => classes.add(item)),
          remove: (...items) => items.forEach(item => classes.delete(item)),
          contains: item => classes.has(item),
        },
        reset() {},
      });
    }
    return elements.get(id);
  }
  const button = { disabled: false, textContent: 'Verify Payment & Generate Pass' };
  const calls = { once: [], set: [], fetch: [] };
  const deadlines = new Map();
  let deadlineId = 0;
  const database = {
    ref(refPath) {
      return {
        once(event) {
          calls.once.push({ path: refPath, event });
          return options.once ? options.once(calls.once.length, refPath) : Promise.resolve(snapshot(null));
        },
        set(payload) {
          calls.set.push({ path: refPath, payload: JSON.parse(JSON.stringify(payload)) });
          return options.set ? options.set(calls.set.length, payload) : Promise.resolve();
        },
      };
    },
  };
  class QRCode { static CorrectLevel = { M: 1, H: 2 }; }
  const context = {
    document: {
      getElementById: element,
      querySelector(selector) {
        if (selector === 'input[name="gender"]:checked') return { value: 'Female' };
        if (selector.includes('ticketCategory')) return { value: 'Student', getAttribute: () => '149' };
        return null;
      },
    },
    window: { addEventListener() {}, scrollTo() {}, location: {}, open() {} },
    firebase: { initializeApp() {}, database: () => database },
    console: { error() {}, log() {} },
    QRCode, AbortController, URL, Uint8Array,
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    setTimeout: (callback, milliseconds) => {
      const id = ++deadlineId;
      deadlines.set(id, { callback, milliseconds });
      return id;
    },
    clearTimeout: id => deadlines.delete(id),
    fetch: async (url, request) => {
      calls.fetch.push({ url, request, body: JSON.parse(request.body) });
      return options.fetch ? options.fetch(url, request) : { ok: true, json: async () => ({ ...uploaded }) };
    },
  };
  vm.runInNewContext(`${script}\nglobalThis.page = { state, handleVerifyAndGeneratePass, handleProceedToPayment, removeImage };`, context);
  const page = context.page;
  Object.assign(page.state, {
    fullName: savedRecord.fullName, age: '28', gender: 'Female',
    email: savedRecord.email, whatsapp: savedRecord.mobile,
    screenshotFile: {
      name: 'proof.png', type: 'image/png',
      arrayBuffer: options.arrayBuffer || (async () => Uint8Array.of(1, 2, 3).buffer),
    },
  });
  element('utrNumber').value = savedRecord.transactionId;
  element('fullName').value = savedRecord.fullName;
  element('age').value = '28';
  element('email').value = savedRecord.email;
  element('whatsapp').value = savedRecord.mobile;
  const event = { preventDefault() {}, target: { querySelector: () => button } };
  return {
    page, button, calls, element,
    submit: () => page.handleVerifyAndGeneratePass(event),
    proceed: () => page.handleProceedToPayment(event),
    passVisible: () => !element('step3Section').classList.contains('hidden'),
    notice: () => `${element('dialogTitle').textContent}: ${element('dialogMessage').textContent}`,
    async expireDeadline() {
      await flush();
      const entry = [...deadlines.entries()].sort((a, b) => a[1].milliseconds - b[1].milliseconds)[0];
      assert.ok(entry, 'the stalled operation has a deadline');
      deadlines.delete(entry[0]);
      entry[1].callback();
      await flush();
    },
  };
}

function assertRetryableFailure(h) {
  assert.equal(h.passVisible(), false, 'no pass is shown before confirmed persistence');
  assert.equal(h.button.disabled, false, 'submit becomes available for retry');
  assert.doesNotMatch(h.button.textContent, /^(Uploading|Saving|Checking)/);
  assert.notEqual(h.element('dialogTitle').textContent, 'Registration Saved');
  assert.ok(h.element('dialogMessage').textContent, 'a visible failure message explains what happened');
}

test('normal submission saves only R2 metadata and shows success after database acknowledgement', async () => {
  const ack = deferred();
  const h = harness({ set: () => ack.promise });
  const submitting = h.submit();
  await flush();
  assert.equal(h.calls.set.length, 1);
  assert.equal(h.passVisible(), false);
  assert.equal(h.button.disabled, true);
  assert.match(h.calls.fetch[0].url, /api\.anticlock\.online\/v1\/event-registration\/payment-screenshot$/);
  assert.equal(h.calls.fetch[0].body.dataBase64, 'AQID');
  const payload = h.calls.set[0].payload;
  assert.equal(payload.screenshotBucket, uploaded.bucket);
  assert.equal(payload.screenshotKey, uploaded.key);
  assert.equal(payload.screenshotUrl, uploaded.screenshotUrl);
  assert.equal(payload.screenshotStorage, 'r2');
  assert.equal('screenshotBase64' in payload, false);
  ack.resolve();
  await submitting;
  assert.equal(h.passVisible(), true);
  assert.equal(h.element('dialogTitle').textContent, 'Registration Saved');
  assert.equal(h.element('passName').textContent, savedRecord.fullName);
  assert.equal(h.button.disabled, false);
});

test('failed R2 upload shows an error, skips database save, and permits a successful retry', async () => {
  const options = { fetch: async () => ({ ok: false, json: async () => ({ error: 'Upload rejected' }) }) };
  const h = harness(options);
  await h.submit();
  assertRetryableFailure(h);
  assert.match(h.notice(), /Upload rejected/);
  assert.equal(h.calls.set.length, 0);
  options.fetch = async () => ({ ok: true, json: async () => ({ ...uploaded }) });
  await h.submit();
  assert.equal(h.passVisible(), true);
  assert.equal(h.calls.fetch.length, 2);
  assert.equal(h.calls.set.length, 1);
});

test('a malformed successful R2 response cannot create a registration without its image metadata', async () => {
  const h = harness({ fetch: async () => ({ ok: true, json: async () => ({ screenshotUrl: uploaded.screenshotUrl }) }) });
  await h.submit();
  assertRetryableFailure(h);
  assert.equal(h.calls.set.length, 0);
});

for (const phase of ['lookup', 'file read', 'upload', 'response body', 'database save']) {
  test(`a stalled ${phase} times out and restores the submit button without false success`, async () => {
    const options = {};
    if (phase === 'lookup') options.once = never;
    if (phase === 'file read') options.arrayBuffer = never;
    if (phase === 'upload') options.fetch = never;
    if (phase === 'response body') options.fetch = async () => ({ ok: true, json: never });
    if (phase === 'database save') options.set = never;
    const h = harness(options);
    const submitting = h.submit();
    await h.expireDeadline();
    await submitting;
    assertRetryableFailure(h);
    if (phase === 'upload' || phase === 'response body') {
      assert.equal(h.calls.fetch[0].request.signal.aborted, true, 'the upload request is aborted on timeout');
    }
  });
}

test('retry of a timed-out database save waits for its same acknowledgement instead of a local pending snapshot', async () => {
  const ack = deferred();
  const h = harness({
    once: count => Promise.resolve(snapshot(count === 1 ? null : savedRecord)),
    set: () => ack.promise,
  });
  const first = h.submit();
  await h.expireDeadline();
  await first;
  assertRetryableFailure(h);
  const retrying = h.submit();
  await flush();
  assert.equal(h.passVisible(), false, 'cached optimistic record is not confirmation');
  assert.equal(h.calls.once.length, 1, 'retry does not read its own unacknowledged cached record');
  assert.equal(h.calls.fetch.length, 1, 'retry reuses the uploaded image');
  assert.equal(h.calls.set.length, 1, 'retry does not enqueue another registration write');
  ack.resolve();
  await retrying;
  assert.equal(h.passVisible(), true);
  assert.equal(h.element('dialogTitle').textContent, 'Registration Saved');
});

test('a rejected database write can retry using the already uploaded R2 image', async () => {
  const h = harness({ set: count => count === 1 ? Promise.reject(new Error('Database permission denied')) : Promise.resolve() });
  await h.submit();
  assertRetryableFailure(h);
  assert.match(h.notice(), /permission denied/i);
  await h.submit();
  assert.equal(h.passVisible(), true);
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.calls.set.length, 2);
});

test('an existing confirmed registration opens its saved pass without uploading or overwriting it', async () => {
  const h = harness({ once: () => Promise.resolve(snapshot(savedRecord)) });
  await h.submit();
  assert.equal(h.passVisible(), true);
  assert.equal(h.element('passRegId').textContent, savedRecord.regId);
  assert.equal(h.calls.fetch.length, 0);
  assert.equal(h.calls.set.length, 0);
  assert.match(h.notice(), /Already Registered/);
  assert.equal(h.button.disabled, false);
});

test('a second submit while one is pending does not duplicate upload or database writes', async () => {
  const ack = deferred();
  const h = harness({ set: () => ack.promise });
  const first = h.submit();
  await flush();
  const second = h.submit();
  await flush();
  assert.equal(h.calls.fetch.length, 1);
  assert.equal(h.calls.set.length, 1);
  ack.resolve();
  await Promise.all([first, second]);
  assert.equal(h.passVisible(), true);
});

test('a stalled registration lookup on the participant step returns an error instead of staying pending', async () => {
  const h = harness({ once: never });
  h.element('step1Section').classList.remove('hidden');
  h.element('step2Section').classList.add('hidden');
  const proceeding = h.proceed();
  await h.expireDeadline();
  await proceeding;
  assert.equal(h.element('step2Section').classList.contains('hidden'), true);
  assert.equal(h.passVisible(), false);
  assert.ok(h.element('dialogMessage').textContent);
});
