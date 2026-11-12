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
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

function harness(options = {}) {
  const elements = new Map();
  const calls = { refs: [], once: [], on: [], off: [], signIn: 0, signOut: 0 };
  const timers = new Map();
  let timerId = 0;
  let authChanged;
  let authFailed;
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
  const auth = {
    currentUser: null,
    onAuthStateChanged(handler, error) { authChanged = handler; authFailed = error; },
    async signInWithPopup(provider) {
      calls.signIn += 1;
      return options.signIn ? options.signIn(provider) : undefined;
    },
    async signOut() {
      calls.signOut += 1;
      if (options.signOut) return options.signOut();
      auth.currentUser = null;
      await authChanged(null);
    },
  };
  function authFactory() { return auth; }
  authFactory.GoogleAuthProvider = class { setCustomParameters(parameters) { this.parameters = parameters; } };
  const database = {
    ref(refPath) {
      calls.refs.push(refPath);
      return {
        once(event) {
          calls.once.push({ path: refPath, event });
          return options.access ? options.access(refPath) : Promise.resolve(snap(true));
        },
        on(event, receive, error) {
          const listener = { path: refPath, event, receive, error };
          calls.on.push(listener);
          if (options.on) options.on(listener);
        },
        off(event, receive) { calls.off.push({ path: refPath, event, receive }); },
        set() { throw new Error('The users page must never write registration data'); },
      };
    },
  };
  const context = {
    document, window: { location: { reload() {} } },
    firebase: { initializeApp() {}, auth: authFactory, database: () => database },
    URL, Intl, Date,
    setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
    clearTimeout: id => timers.delete(id),
    console: { error() {}, log() {} },
  };
  if (options.noSdk) delete context.firebase;
  vm.runInNewContext(source, context);
  return {
    model: context.window.UsersRoster, calls, element, context,
    async user(user) { auth.currentUser = user; await authChanged(user); await flush(); },
    failAuth: () => authFailed(new Error('unavailable')),
    emit(value, listener = calls.on.at(-1)) { assert.ok(listener, 'an authorised subscription exists'); listener.receive(snap(value)); },
    deny(error = { code: 'PERMISSION_DENIED' }, listener = calls.on.at(-1)) { listener.error(error); },
    async expire() {
      await flush(); const [id, timer] = [...timers.entries()][0] || [];
      assert.ok(timer, 'pending operation has a deadline'); timers.delete(id); timer.callback(); await flush();
    },
  };
}
const organiser = { uid: 'approved-organiser', email: 'organiser@example.test' };
function record(index = 1, overrides = {}) {
  return { fullName: `Participant ${index}`, mobile: `900000${String(index).padStart(4, '0')}`, email: `person${index}@example.test`, age: 24, gender: 'Female', category: 'Student', quantity: 1, unitPrice: 149, totalAmount: 149, transactionId: `UTR-${index}`, regId: `REG-${index}`, createdAt: new Date(Date.UTC(2026, 10, index)).toISOString(), ...overrides };
}
async function load(value, options) { const h = harness(options); await h.user(organiser); h.emit(value); return h; }
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
  await h.user(organiser);
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

test('signed-out and unapproved accounts do not request the registrations collection', async () => {
  const h = harness({ access: async () => snap(false) });
  await h.user(null); assert.equal(h.calls.refs.length, 0);
  await h.user(organiser);
  assert.deepEqual(h.calls.refs, ['registrationAdmins/approved-organiser']);
  assert.equal(h.calls.on.length, 0);
  assert.equal(h.element('roster').hidden, true);
  assert.equal(h.element('statusTitle').textContent, 'Organiser access required');
  assert.equal(h.element('accountId').hidden, false);
  assert.equal(h.element('accountId').textContent, 'Account ID: approved-organiser');
  await h.user(null);
  assert.equal(h.element('accountId').textContent, '');
  assert.equal(h.element('accountId').hidden, true);
});

test('a rejected admin flag read fails closed with a clear access message', async () => {
  const h = harness({ access: async () => { throw { code: 'PERMISSION_DENIED' }; } });
  await h.user(organiser);
  assert.equal(h.calls.on.length, 0);
  assert.equal(h.element('roster').hidden, true);
  assert.equal(h.element('retry').hidden, false);
  assert.match(h.element('statusMessage').textContent, /not been configured/);
  assert.notEqual(h.element('emptyTitle').textContent, 'No registrations yet');
});

test('collection permission denial clears sensitive rows and is not shown as an empty database', async () => {
  const h = await load({ a: record(1) });
  const listener = h.calls.on[0];
  h.deny({ code: 'PERMISSION_DENIED' });
  assert.equal(h.element('rows').children.length, 0);
  assert.equal(h.element('roster').hidden, true);
  assert.match(h.element('statusMessage').textContent, /does not have permission/);
  assert.equal(h.element('retry').hidden, false);
  assert.equal(h.calls.off.length, 1);
  h.element('search').value = 'queued search'; await h.element('search').dispatch('input');
  await h.element('next').dispatch('click');
  assert.equal(h.element('roster').hidden, true, 'queued filter events cannot show a false empty roster after denial');
  h.emit({ a: record(2) }, listener);
  assert.equal(h.element('rows').children.length, 0, 'cancelled data callback cannot restore records');
});

test('an authenticated empty snapshot is distinguished from an error', async () => {
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
  const detailsButton = h.element('rows').children[0].children[5].children[0];
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
  await h.element('rows').children[0].children[5].children[0].dispatch('click');
  const link = h.element('proof').children[0];
  assert.equal(link.href, 'https://proof.example.test/image?signature=test');
  assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.referrerPolicy, 'no-referrer');
  assert.match(h.element('detailFields').textContent, /UTR-1/);
  assert.match(h.element('detailFields').textContent, /registration\/a\.png/);
});

test('sign-out immediately clears rows, open details, totals and subscriptions before awaiting auth', async () => {
  const pending = deferred();
  const h = await load({ a: record(1) }, { signOut: () => pending.promise });
  const listener = h.calls.on[0];
  await h.element('rows').children[0].children[5].children[0].dispatch('click');
  const signingOut = h.element('signOut').dispatch('click'); await flush();
  assert.equal(h.element('roster').hidden, true); assert.equal(h.element('rows').children.length, 0);
  assert.equal(h.element('detailFields').children.length, 0); assert.equal(h.element('proof').children.length, 0);
  assert.equal(h.element('detailName').textContent, ''); assert.equal(h.element('totalUsers').textContent, '0');
  assert.equal(h.calls.off.length, 1);
  h.emit({ a: record(3) }, listener);
  assert.equal(h.element('rows').children.length, 0, 'late data cannot repopulate a signed-out view');
  pending.resolve(); await signingOut;
});

test('stale organiser access acknowledgements cannot subscribe after sign-out or account switch', async () => {
  const access = deferred();
  const h = harness({ access: refPath => refPath.endsWith('/first') ? access.promise : Promise.resolve(snap(false)) });
  const first = h.user({ uid: 'first', email: 'first@example.test' }); await flush();
  await h.user({ uid: 'second', email: 'second@example.test' });
  access.resolve(snap(true)); await first;
  assert.equal(h.calls.on.length, 0);
  assert.equal(h.element('accountEmail').textContent, 'second@example.test');
  assert.equal(h.element('roster').hidden, true);
});

test('account switch unsubscribes existing data and ignores the previous account callbacks', async () => {
  const h = await load({ a: record(1) }); const listener = h.calls.on[0];
  await h.user({ uid: 'next-organiser', email: 'next@example.test' });
  assert.equal(h.calls.off.length, 1); assert.equal(h.element('rows').children.length, 0);
  h.emit({ a: record(9) }, listener); assert.equal(h.element('rows').children.length, 0);
  h.emit({ b: record(2) }); assert.deepEqual(rowNames(h), ['Participant 2']);
});

test('access and data timeouts give a retry state and ignore late callbacks', async () => {
  const access = deferred(); const gated = harness({ access: () => access.promise });
  const signingIn = gated.user(organiser); await gated.expire(); await signingIn;
  assert.equal(gated.calls.on.length, 0); assert.equal(gated.element('retry').hidden, false);
  access.resolve(snap(true)); await flush(); assert.equal(gated.calls.on.length, 0);
  const h = harness(); await h.user(organiser); const listener = h.calls.on[0];
  await h.expire(); assert.equal(h.element('retry').hidden, false); assert.equal(h.element('roster').hidden, true);
  h.emit({ a: record(1) }, listener); assert.equal(h.element('rows').children.length, 0);
  await h.element('retry').dispatch('click'); h.emit({ a: record(2) });
  assert.deepEqual(rowNames(h), ['Participant 2']);
});

test('Google configuration failures are visible and the sign-in button is restored', async () => {
  const h = harness({ signIn: async () => { throw { code: 'auth/configuration-not-found' }; } });
  await h.element('signIn').dispatch('click');
  assert.equal(h.element('signIn').disabled, false);
  assert.equal(h.element('status').hidden, false);
  assert.equal(h.element('statusTitle').textContent, 'Sign-in not completed');
  assert.match(h.element('statusMessage').textContent, /not enabled|finish sign-in setup/i);
  assert.equal(h.calls.on.length, 0);
});

test('SDK failure shows an actionable error and never creates a collection request', () => {
  const h = harness({ noSdk: true });
  assert.equal(h.element('statusTitle').textContent, 'Connection unavailable');
  assert.equal(h.element('retry').hidden, false); assert.equal(h.calls.on.length, 0);
  assert.equal(h.element('roster').hidden, true);
});


test('only the boolean approved-admin flag can unlock collection access', async () => {
  for (const flag of [null, false, 'true', 1, {}, []]) {
    const h = harness({ access: async () => snap(flag) });
    await h.user(organiser);
    assert.equal(h.calls.on.length, 0, `flag ${JSON.stringify(flag)} is not approval`);
    assert.equal(h.element('roster').hidden, true);
  }
});

test('auth service failure invalidates a pending admin check before it can unlock data', async () => {
  const access = deferred(); const h = harness({ access: () => access.promise });
  const checking = h.user(organiser); await flush();
  h.failAuth();
  access.resolve(snap(true)); await checking;
  assert.equal(h.calls.on.length, 0, 'stale role acknowledgement cannot recover from an auth failure');
  assert.equal(h.element('roster').hidden, true);
  assert.equal(h.element('rows').children.length, 0);
  assert.equal(h.element('statusTitle').textContent, 'Sign-in unavailable');
  assert.equal(h.element('accountId').textContent, '');
  assert.equal(h.element('accountEmail').textContent, '');
  assert.equal(h.element('loginPanel').hidden, false);
});
