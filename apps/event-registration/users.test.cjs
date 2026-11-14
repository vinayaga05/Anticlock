const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = readFileSync(path.join(__dirname, 'users/index.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .find(script => script.includes('// Registered users application.'));
assert.ok(source, 'the users page contains its application script');
const snap = value => ({ val: () => value });
const flush = () => new Promise(resolve => setImmediate(resolve));
function plain(value) { return JSON.parse(JSON.stringify(value)); }
function deferred() {
  let resolve; let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(value, status = 200, etag = '"record-v1"') {
  return { ok: status >= 200 && status < 300, status, headers: { get: name => name.toLowerCase() === 'etag' ? etag : null }, json: async () => value };
}

function harness(options = {}) {
  const elements = new Map();
  const calls = { refs: [], on: [], off: [], auth: 0, reload: 0, fetch: [] };
  const timers = new Map();
  let serverRecords = {};
  let timerId = 0;
  let document;
  class Element {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase(); this.id = id; this.children = [];
      this._text = ''; this.listeners = new Map(); this.attributes = {};
      this.dataset = {}; this.hidden = false; this.disabled = false; this.value = '';
    }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set innerHTML(_) { throw new Error('Participant content must not be inserted as HTML'); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ''; this.children = children; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    }
    async dispatch(type, detail = {}) {
      const event = { target: this, preventDefault() {}, ...detail };
      await Promise.all((this.listeners.get(type) || []).map(handler => handler(event)));
    }
    focus() { document.activeElement = this; }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    querySelectorAll(selector) {
      const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll(selector)]);
      return descendants.filter(child => child.tagName === 'BUTTON' || child.tagName === 'A' && child.href);
    }
  }
  const element = id => {
    if (!elements.has(id)) {
      const opening = html.match(new RegExp(`<[^>]+\\bid="${id}"[^>]*>`))?.[0] || '';
      const el = new Element((opening.match(/^<(\w+)/) || [0, 'div'])[1], id);
      el.hidden = /\shidden(?:\s|>)/.test(opening);
      elements.set(id, el);
    }
    return elements.get(id);
  };
  document = {
    activeElement: null,
    listeners: new Map(),
    getElementById: element,
    createElement: tag => new Element(tag),
    addEventListener(type, handler) { this.listeners.set(type, handler); },
  };
  const database = {
    ref(refPath) {
      calls.refs.push(refPath);
      if (options.refError) throw options.refError;
      return {
        on(event, receive, error) {
          const listener = { path: refPath, event, receive, error };
          calls.on.push(listener);
          if (options.on) options.on(listener);
        },
        off(event, receive) { calls.off.push({ path: refPath, event, receive }); },
        set() { throw new Error('Record writes must use conditional REST requests'); },
        update() { throw new Error('Record writes must use conditional REST requests'); },
        remove() { throw new Error('Record writes must use conditional REST requests'); },
        push() { throw new Error('The roster must not create new registrations'); },
      };
    },
  };
  const context = {
    document, window: { location: { reload() { calls.reload += 1; } } },
    firebase: { initializeApp() {}, auth() { calls.auth += 1; throw new Error('The roster must load without Firebase Auth'); }, database: () => database },
    URL, Intl, Date, AbortController,
    fetch: async (url, request = {}) => {
      calls.fetch.push({ url, request });
      if (options.fetch) return options.fetch(url, request, calls.fetch.length);
      const key = decodeURIComponent(new URL(url).pathname.split('/').at(-1).replace(/\.json$/, ''));
      if (!request.method || request.method === 'GET') return response(serverRecords[key] ?? null);
      if (request.method === 'PUT') { serverRecords[key] = JSON.parse(request.body); return response(serverRecords[key]); }
      if (request.method === 'DELETE') { delete serverRecords[key]; return response(null); }
      throw new Error(`Unexpected method: ${request.method}`);
    },
    setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout: id => timers.delete(id),
    console: { error() {}, log() {} },
  };
  if (options.noSdk) delete context.firebase;
  vm.runInNewContext(source, context);
  return {
    model: context.window.UsersRoster, calls, element, context,
    emit(value, listener = calls.on.at(-1)) { assert.ok(listener, 'a registrations subscription exists'); serverRecords = plain(value || {}); listener.receive(snap(value)); },
    deny(error = { code: 'PERMISSION_DENIED' }, listener = calls.on.at(-1)) { listener.error(error); },
    async expire() {
      await flush(); const [id, timer] = [...timers.entries()][0] || [];
      assert.ok(timer, 'pending operation has a deadline'); timers.delete(id); timer.callback(); await flush();
    },
  };
}
function record(index = 1, overrides = {}) {
  return { fullName: `Participant ${index}`, mobile: `900000${String(index).padStart(4, '0')}`, email: `person${index}@example.test`, age: 24, gender: 'Female', category: 'Student', quantity: 1, unitPrice: 149, totalAmount: 149, transactionId: `UTR-${index}`, regId: `REG-${index}`, createdAt: new Date(Date.UTC(2026, 10, index)).toISOString(), ...overrides };
}
async function load(value, options) { const h = harness(options); h.emit(value); return h; }
function rowNames(h) { return h.element('rows').children.map(row => row.children[0].children[0].textContent); }

// Model checks use real Firebase-shaped snapshots and legacy aliases.
test('normalizes current and legacy records, retains details, and sorts newest first', () => {
  const h = harness();
  const rows = plain(h.model.normalizedRecords({
    '9000000001': record(1),
    '9000000002': { firstName: 'Legacy', lastName: 'Person', whatsapp: '+91 9000000002', email: 'legacy@example.test', category: 'vip pass', ticketCount: '2', unitPrice: '999', utr: 'OLD-UTR', registrationId: 'LEG-2', registeredAt: '2026-11-02T08:00:00Z', screenshotUrl: 'https://proof.example.test/image.png', screenshotBucket: 'documents', screenshotKey: 'registration/legacy.png', sex: 'Male' },
    invalid: null, text: 'not a record', list: [],
  }));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, 'Legacy Person');
  assert.equal(rows[0].mobile, '+91 9000000002');
  assert.equal(rows[0].category, 'VIP');
  assert.equal(rows[0].quantity, 2);
  assert.equal(rows[0].amount, 1998);
  assert.equal(rows[0].utr, 'OLD-UTR');
  assert.equal(rows[0].regId, 'LEG-2');
  assert.equal(rows[0].screenshotKey, 'registration/legacy.png');
  assert.equal(rows[0].gender, 'Male');
  assert.equal(rows[1].name, 'Participant 1');
});

test('malformed amounts, dates and empty snapshots remain safe to render', async () => {
  const h = harness();
  assert.deepEqual(plain(h.model.normalizedRecords(null)), []);
  assert.deepEqual(plain(h.model.normalizedRecords('unavailable')), []);
  const value = {
    a: { fullName: 'Bad numeric date', createdAt: 1e99, quantity: -2, totalAmount: 'not a number' },
    b: { fullName: 'Object date', createdAt: { toString: 'not callable' }, age: {} },
    c: { name: 'Unknown date', createdAt: 'not a date', quantity: '2.5' },
  };
  assert.doesNotThrow(() => h.emit(value));
  const rows = plain(h.model.normalizedRecords(value));
  assert.equal(rows.length, 3);
  assert.ok(rows.every(row => row.created === null && row.quantity === null && row.amount === null));
  assert.equal(h.element('rows').children.length, 3);
});

test('filters across name, contact, registration ID and UTR with category and all search terms', () => {
  const h = harness(); const rows = h.model.normalizedRecords({ a: record(1, { fullName: 'Asha Kumar', category: 'VIP', regId: 'SPECIAL-1', transactionId: 'REF-900' }), b: record(2) });
  for (const query of ['ASHA', '9000000001', 'person1@example.test', 'special-1', 'ref-900', 'asha ref-900']) {
    assert.equal(h.model.filteredRecords(rows, query, 'VIP').length, 1, query);
  }
  assert.equal(h.model.filteredRecords(rows, 'asha missing', '').length, 0);
  assert.equal(h.model.filteredRecords(rows, 'asha', 'Student').length, 0);
});

test('loads registrations immediately without sign-in, admin checks or Firebase Auth', () => {
  const h = harness();
  assert.equal(h.calls.auth, 0);
  assert.deepEqual(h.calls.refs, ['registrations']);
  assert.equal(h.calls.on.length, 1);
  assert.equal(h.calls.on[0].event, 'value');
  assert.equal(h.element('statusTitle').textContent, 'Loading registrations');
  assert.equal(h.element('roster').hidden, true);
  assert.doesNotMatch(html, /firebase-auth-compat|id="(?:loginPanel|signIn|signOut)"|registrationAdmins/);
  h.emit({ a: record(1) });
  assert.equal(h.element('roster').hidden, false);
  assert.equal(h.element('status').hidden, true);
  assert.deepEqual(rowNames(h), ['Participant 1']);
});

test('collection permission denial clears sensitive rows and is not shown as an empty database', async () => {
  const h = await load({ a: record(1) });
  const listener = h.calls.on[0];
  h.deny({ code: 'PERMISSION_DENIED' });
  assert.equal(h.element('rows').children.length, 0);
  assert.equal(h.element('roster').hidden, true);
  assert.match(h.element('statusMessage').textContent, /does not allow reading/);
  assert.equal(h.element('retry').hidden, false);
  assert.equal(h.calls.off.length, 1);
  h.element('search').value = 'queued search'; await h.element('search').dispatch('input');
  await h.element('next').dispatch('click');
  assert.equal(h.element('roster').hidden, true, 'queued filter events cannot show a false empty roster after denial');
  h.emit({ a: record(2) }, listener);
  assert.equal(h.element('rows').children.length, 0, 'cancelled data callback cannot restore records');
});

test('an empty snapshot is distinguished from an error', async () => {
  const h = await load(null);
  assert.equal(h.element('roster').hidden, false);
  assert.equal(h.element('status').hidden, true);
  assert.equal(h.element('empty').hidden, false);
  assert.equal(h.element('emptyTitle').textContent, 'No registrations yet');
  assert.equal(h.element('totalUsers').textContent, '0');
});

test('all records remain reachable across client pagination and filtering resets the page', async () => {
  const data = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`key-${i}`, record(i + 1)]));
  const h = await load(data);
  assert.equal(h.element('totalUsers').textContent, '45');
  assert.equal(h.element('rows').children.length, 20);
  assert.equal(h.element('pageLabel').textContent, 'Page 1 of 3');
  assert.deepEqual(rowNames(h).slice(0, 2), ['Participant 45', 'Participant 44']);
  const seen = [...rowNames(h)];
  await h.element('next').dispatch('click'); seen.push(...rowNames(h));
  await h.element('next').dispatch('click'); seen.push(...rowNames(h));
  assert.equal(seen.length, 45); assert.equal(new Set(seen).size, 45);
  assert.equal(h.element('next').disabled, true);
  h.element('search').value = 'person1@example.test'; await h.element('search').dispatch('input');
  assert.equal(h.element('pageLabel').textContent, 'Page 1 of 1');
  assert.equal(h.element('rows').children.length, 1);
  assert.deepEqual(rowNames(h), ['Participant 1']);
});

test('participant values remain text and unsafe screenshot links are never rendered', async () => {
  const malicious = '<img src=x onerror=alert(1)>';
  const h = await load({ a: record(1, { fullName: malicious, email: '<script>bad()</script>', screenshotUrl: 'javascript:alert(1)' }) });
  assert.equal(rowNames(h)[0], malicious);
  assert.match(h.element('rows').textContent, /<script>bad\(\)<\/script>/);
  const detailsButton = rowAction(h, 0);
  await detailsButton.dispatch('click');
  assert.equal(h.element('details').hidden, false);
  assert.equal(h.element('detailName').textContent, malicious);
  assert.equal(h.element('proof').children.some(child => child.tagName === 'A'), false);
  assert.match(h.element('proof').textContent, /No valid screenshot link/);
  for (const value of ['javascript:alert(1)', 'data:image/png;base64,a', '/relative', '//example.test/proof', 'file:///private']) assert.equal(h.model.safeUrl(value), null);
  assert.equal(h.model.safeUrl(' https://proof.example.test/a.png '), 'https://proof.example.test/a.png');
});

test('safe proof links open separately without exposing a referrer and detail values are retained', async () => {
  const h = await load({ a: record(1, { screenshotUrl: 'https://proof.example.test/image?signature=test', screenshotStorage: 'r2', screenshotBucket: 'documents', screenshotKey: 'registration/a.png' }) });
  await rowAction(h, 0).dispatch('click');
  const link = h.element('proof').children[0];
  assert.equal(link.href, 'https://proof.example.test/image?signature=test');
  assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.referrerPolicy, 'no-referrer');
  assert.match(h.element('detailFields').textContent, /UTR-1/);
  assert.match(h.element('detailFields').textContent, /registration\/a\.png/);
});

test('refresh clears details and old rows, replaces the listener, and ignores stale callbacks', async () => {
  const h = await load({ a: record(1) });
  const listener = h.calls.on[0];
  await rowAction(h, 0).dispatch('click');
  await h.element('refresh').dispatch('click');
  assert.equal(h.element('roster').hidden, true); assert.equal(h.element('rows').children.length, 0);
  assert.equal(h.element('detailFields').children.length, 0); assert.equal(h.element('proof').children.length, 0);
  assert.equal(h.element('detailName').textContent, ''); assert.equal(h.element('totalUsers').textContent, '0');
  assert.equal(h.calls.off.length, 1); assert.equal(h.calls.on.length, 2);
  h.emit({ a: record(3) }, listener);
  assert.equal(h.element('rows').children.length, 0, 'late data cannot repopulate a refreshed view');
  h.emit({ b: record(2) });
  h.deny({ code: 'PERMISSION_DENIED' }, listener);
  assert.deepEqual(rowNames(h), ['Participant 2'], 'old error callback cannot clear the current subscription');
});

test('data timeout gives a retry state and ignores late callbacks', async () => {
  const h = harness(); const listener = h.calls.on[0];
  await h.expire(); assert.equal(h.element('retry').hidden, false); assert.equal(h.element('roster').hidden, true);
  assert.equal(h.calls.off.length, 1);
  h.emit({ a: record(1) }, listener); assert.equal(h.element('rows').children.length, 0);
  await h.element('retry').dispatch('click'); h.emit({ a: record(2) });
  assert.deepEqual(rowNames(h), ['Participant 2']);
});

test('permission denial can recover after database access is corrected', async () => {
  const h = harness(); const listener = h.calls.on[0];
  h.deny();
  assert.equal(h.element('retry').hidden, false);
  await h.element('retry').dispatch('click');
  assert.equal(h.calls.on.length, 2);
  h.emit({ a: record(1) });
  assert.equal(h.element('status').hidden, true);
  assert.deepEqual(rowNames(h), ['Participant 1']);
  h.emit({ b: record(2) }, listener);
  assert.deepEqual(rowNames(h), ['Participant 1']);
});

test('realtime snapshots update totals and preserve the current search', async () => {
  const h = await load({ a: record(1), b: record(2) });
  h.element('search').value = 'person1@example.test'; await h.element('search').dispatch('input');
  h.emit({ a: record(1, { quantity: 2, totalAmount: 298 }), b: record(2), c: record(3) });
  assert.equal(h.element('totalUsers').textContent, '3');
  assert.equal(h.element('totalPasses').textContent, '4');
  assert.equal(h.element('totalAmount').textContent, '₹596.00');
  assert.deepEqual(rowNames(h), ['Participant 1']);
  assert.match(h.element('resultCount').textContent, /1 matching · 3 total/);
});

test('SDK failure shows an actionable error and never creates a collection request', () => {
  const h = harness({ noSdk: true });
  assert.equal(h.element('statusTitle').textContent, 'Connection unavailable');
  assert.equal(h.element('retry').hidden, false); assert.equal(h.calls.on.length, 0);
  assert.equal(h.element('roster').hidden, true);
});


test('synchronous subscription errors show a retry state without a false empty list', () => {
  const h = harness({ on: () => { throw new Error('network unavailable'); } });
  assert.equal(h.element('statusTitle').textContent, 'Unable to load registrations');
  assert.equal(h.element('retry').hidden, false);
  assert.equal(h.element('roster').hidden, true);
  assert.equal(h.calls.off.length, 1);
});

test('a synchronous initial snapshot completes loading and cancels its deadline', async () => {
  const h = harness({ on: listener => listener.receive(snap({ a: record(1) })) });
  assert.deepEqual(rowNames(h), ['Participant 1']);
  assert.equal(h.element('status').hidden, true);
  await assert.rejects(h.expire(), /pending operation has a deadline/);
});

test('queued filter events cannot expose an empty list before the first snapshot', async () => {
  const h = harness();
  h.element('search').value = 'any'; await h.element('search').dispatch('input');
  await h.element('next').dispatch('click');
  assert.equal(h.element('roster').hidden, true);
  assert.equal(h.element('statusTitle').textContent, 'Loading registrations');
});

function rowAction(h, index) { return h.element('rows').children[0].children[5].querySelectorAll('button')[index]; }
const editableRecord = overrides => record(1, { transactionId: '123456789012', utr: '123456789012', ...overrides });
function editDraft(h, values = {}) {
  for (const [id, value] of Object.entries(values)) h.element(id).value = String(value);
}

test('edit and delete open prefilled dialogs and cancellation sends no writes', async () => {
  const original = editableRecord(); const h = await load({ '9000000001': original });
  const actions = h.element('rows').children[0].children[5].querySelectorAll('button');
  assert.deepEqual(actions.map(button => button.textContent), ['Details', 'Edit', 'Delete']);
  await rowAction(h, 1).dispatch('click');
  assert.equal(h.element('editDialog').hidden, false);
  assert.equal(h.element('editName').value, original.fullName);
  assert.equal(h.element('editEmail').value, original.email);
  assert.equal(String(h.element('editMobile').value), original.mobile);
  assert.equal(h.element('editRegId').value || h.element('editRegId').textContent, original.regId);
  await h.element('cancelEdit').dispatch('click');
  assert.equal(h.element('editDialog').hidden, true);
  await rowAction(h, 2).dispatch('click');
  assert.equal(h.element('deleteDialog').hidden, false);
  assert.match(h.element('deleteName').textContent, /Participant 1/);
  assert.equal(h.calls.fetch.filter(call => ['PUT', 'DELETE'].includes(call.request.method)).length, 0);
  await h.element('cancelDelete').dispatch('click');
  assert.equal(h.element('deleteDialog').hidden, true);
  assert.equal(h.calls.fetch.length, 0);
});

test('save waits for server acknowledgement and preserves identity, dates, unknown fields and proof metadata', async () => {
  const original = editableRecord({ screenshotUrl: 'https://proof.example.test/a', screenshotBucket: 'documents', screenshotKey: 'registration/proof.png', screenshotStorage: 'r2', approved: { by: 'owner', value: false } });
  const ack = deferred();
  const h = await load({ '9000000001': original }, { fetch: (url, request) => request.method === 'PUT' ? ack.promise : response(original) });
  await rowAction(h, 1).dispatch('click');
  editDraft(h, { editName: 'Updated Person', editEmail: 'updated@example.test', editAge: '30', editGender: 'Male', editCategory: 'VIP', editQuantity: '2', editUnitPrice: '999', editUtr: '999999999999', editMobile: 'other-mobile', editRegId: 'forged-id' });
  const saving = h.element('editForm').dispatch('submit'); await flush();
  assert.equal(h.calls.fetch.length, 2);
  const [read, write] = h.calls.fetch;
  assert.equal(read.request.headers['X-Firebase-ETag'], 'true');
  assert.equal(write.request.method, 'PUT');
  assert.equal(write.request.headers['if-match'], '"record-v1"');
  assert.equal(new URL(write.url).pathname, '/registrations/9000000001.json');
  const payload = JSON.parse(write.request.body);
  assert.equal(payload.fullName, 'Updated Person'); assert.equal(payload.email, 'updated@example.test');
  assert.equal(payload.age, 30); assert.equal(payload.quantity, 2); assert.equal(payload.totalAmount, 1998);
  assert.equal(payload.transactionId, '999999999999'); assert.equal(payload.utr, payload.transactionId);
  for (const key of ['mobile', 'regId', 'createdAt', 'issuedAt', 'screenshotUrl', 'screenshotBucket', 'screenshotKey', 'screenshotStorage', 'approved']) assert.deepEqual(payload[key], original[key], key);
  assert.equal(h.element('editDialog').hidden, false, 'the dialog remains open before server acknowledgement');
  assert.equal(h.element('saveEdit').disabled, true);
  assert.doesNotMatch(h.element('statusTitle').textContent, /saved|updated/i);
  await h.element('editForm').dispatch('submit');
  assert.equal(h.calls.fetch.length, 2, 'a pending save cannot enqueue another write');
  ack.resolve(response(payload)); await saving;
  assert.equal(h.element('editDialog').hidden, true);
  assert.match(h.element('statusTitle').textContent, /saved|updated/i);
});

test('invalid edit values never issue a network request', async () => {
  const h = await load({ '9000000001': editableRecord() });
  await rowAction(h, 1).dispatch('click');
  for (const values of [{ editName: '' }, { editName: 'Person', editEmail: 'invalid' }, { editEmail: 'valid@example.test', editQuantity: '0' }, { editQuantity: '1', editUtr: 'bad-utr' }]) {
    editDraft(h, values); await h.element('editForm').dispatch('submit');
    assert.equal(h.calls.fetch.length, 0);
    assert.equal(h.element('editDialog').hidden, false);
    assert.ok(h.element('editError').textContent);
  }
});

test('unrelated realtime updates do not discard an edit draft or delete confirmation', async () => {
  const original = editableRecord(); const h = await load({ '9000000001': original });
  await rowAction(h, 1).dispatch('click'); h.element('editName').value = 'Unsaved draft';
  h.emit({ '9000000001': original, another: record(2) });
  assert.equal(h.element('editDialog').hidden, false);
  assert.equal(h.element('editName').value, 'Unsaved draft');
  await h.element('cancelEdit').dispatch('click');
  const lastRow = h.element('rows').children.at(-1); await lastRow.children[5].querySelectorAll('button')[2].dispatch('click');
  h.emit({ '9000000001': original, another: record(3) });
  assert.equal(h.element('deleteDialog').hidden, false);
  assert.equal(h.calls.fetch.length, 0);
});

for (const action of ['edit', 'delete']) {
  test(`${action} refuses stale or missing registrations before a write`, async () => {
    const original = editableRecord();
    for (const current of [null, { ...original, fullName: 'Changed elsewhere' }]) {
      const h = await load({ '9000000001': original }, { fetch: () => response(current) });
      await rowAction(h, action === 'edit' ? 1 : 2).dispatch('click');
      await h.element(action === 'edit' ? 'editForm' : 'deleteConfirm').dispatch(action === 'edit' ? 'submit' : 'click');
      assert.equal(h.calls.fetch.length, 1);
      assert.match(h.element(action === 'edit' ? 'editError' : 'deleteError').textContent, /changed|removed|deleted|longer|refresh/i);
    }
  });

  test(`${action} reports permission denial and a conditional write conflict without false success`, async () => {
    const original = editableRecord();
    for (const status of [401, 403, 412]) {
      const h = await load({ '9000000001': original }, { fetch: (url, request) => request.method === 'GET' ? response(original) : response({ error: 'Rejected' }, status) });
      await rowAction(h, action === 'edit' ? 1 : 2).dispatch('click');
      await h.element(action === 'edit' ? 'editForm' : 'deleteConfirm').dispatch(action === 'edit' ? 'submit' : 'click');
      assert.equal(h.calls.fetch.length, 2);
      assert.equal(h.element(action === 'edit' ? 'editDialog' : 'deleteDialog').hidden, false);
      assert.ok(h.element(action === 'edit' ? 'editError' : 'deleteError').textContent);
      assert.equal(h.element(action === 'edit' ? 'saveEdit' : 'deleteConfirm').disabled, false);
      assert.doesNotMatch(h.element('statusTitle').textContent, /saved|updated|deleted/i);
    }
  });

  test(`${action} times out stalled requests and treats an aborted write as unconfirmed`, async () => {
    const original = editableRecord(); let signal;
    const h = await load({ '9000000001': original }, { fetch: (url, request) => {
      if (request.method === 'GET') return response(original);
      signal = request.signal;
      return new Promise((resolve, reject) => request.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))));
    } });
    await rowAction(h, action === 'edit' ? 1 : 2).dispatch('click');
    const pending = h.element(action === 'edit' ? 'editForm' : 'deleteConfirm').dispatch(action === 'edit' ? 'submit' : 'click');
    await flush(); await h.expire(); await pending;
    assert.equal(signal.aborted, true);
    assert.match(h.element(action === 'edit' ? 'editError' : 'deleteError').textContent, /confirm|refresh|timed out|check/i);
    assert.equal(h.element(action === 'edit' ? 'editDialog' : 'deleteDialog').hidden, false);
    assert.equal(h.calls.fetch.length, 2);
  });
}

test('confirmed delete waits for acknowledgement and targets only the selected registration', async () => {
  const original = editableRecord(); const ack = deferred();
  const h = await load({ '9000000001': original }, { fetch: (url, request) => request.method === 'DELETE' ? ack.promise : response(original) });
  await rowAction(h, 2).dispatch('click');
  const pending = h.element('deleteConfirm').dispatch('click'); await flush();
  assert.equal(h.calls.fetch.length, 2);
  const write = h.calls.fetch[1];
  assert.equal(write.request.method, 'DELETE'); assert.equal(write.request.headers['if-match'], '"record-v1"');
  assert.equal(new URL(write.url).pathname, '/registrations/9000000001.json');
  assert.equal(h.element('deleteDialog').hidden, false); assert.equal(h.element('deleteConfirm').disabled, true);
  await h.element('deleteConfirm').dispatch('click'); assert.equal(h.calls.fetch.length, 2);
  assert.doesNotMatch(h.element('statusTitle').textContent, /deleted/i);
  ack.resolve(response(null)); await pending;
  assert.equal(h.element('deleteDialog').hidden, true);
  assert.match(h.element('statusTitle').textContent, /deleted/i);
  assert.ok(h.calls.fetch.every(call => call.url.startsWith('https://knock-bafe3-default-rtdb.firebaseio.com/registrations/')), 'no screenshot storage calls are made');
});

test('a missing ETag prevents writes and stable key ordering does not create a false conflict', async () => {
  const original = editableRecord(); const reversed = Object.fromEntries(Object.entries(original).reverse());
  const h = await load({ '9000000001': original }, { fetch: () => response(reversed, 200, null) });
  await rowAction(h, 1).dispatch('click'); await h.element('editForm').dispatch('submit');
  assert.equal(h.calls.fetch.length, 1); assert.ok(h.element('editError').textContent);
  assert.equal(h.model.sameRecord(original, reversed), true);
});

for (const action of ['edit', 'delete']) {
  test(`${action} acknowledgement cannot overwrite a newer realtime record`, async () => {
    const original = editableRecord(); const ack = deferred();
    const h = await load({ '9000000001': original }, { fetch: (url, request) => request.method === 'GET' ? response(original) : ack.promise });
    await rowAction(h, action === 'edit' ? 1 : 2).dispatch('click');
    if (action === 'edit') editDraft(h, { editName: 'This write' });
    const pending = h.element(action === 'edit' ? 'editForm' : 'deleteConfirm').dispatch(action === 'edit' ? 'submit' : 'click'); await flush();
    const newer = { ...original, fullName: 'Newer server record' };
    h.emit({ '9000000001': newer });
    ack.resolve(response(action === 'delete' ? null : JSON.parse(h.calls.fetch[1].request.body))); await pending;
    assert.deepEqual(rowNames(h), ['Newer server record']);
  });

  test(`${action} response-body timeout blocks another attempt and ignores a late success`, async () => {
    const original = editableRecord(); const body = deferred();
    const h = await load({ '9000000001': original }, { fetch: (url, request) => request.method === 'GET' ? response(original) : { ...response(null), json: () => body.promise } });
    await rowAction(h, action === 'edit' ? 1 : 2).dispatch('click');
    const pending = h.element(action === 'edit' ? 'editForm' : 'deleteConfirm').dispatch(action === 'edit' ? 'submit' : 'click'); await flush();
    await h.expire(); await pending;
    assert.equal(h.element(action === 'edit' ? 'saveEdit' : 'deleteConfirm').disabled, true);
    assert.equal(h.element(action === 'edit' ? 'cancelEdit' : 'cancelDelete').disabled, false);
    body.resolve(action === 'delete' ? null : JSON.parse(h.calls.fetch[1].request.body)); await flush();
    assert.doesNotMatch(h.element('statusTitle').textContent, /saved|deleted/i);
    assert.equal(h.element(action === 'edit' ? 'editDialog' : 'deleteDialog').hidden, false);
  });
}
