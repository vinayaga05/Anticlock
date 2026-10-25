import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { StreamChat } from 'stream-chat';

const enabled = process.env.RUN_STREAM_INTEGRATION === '1'
  && Boolean(process.env.DATABASE_URL && process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET);

describe('direct messaging lifecycle (database + Stream)', { skip: !enabled, timeout: 60_000 }, () => {
  const A = randomUUID();
  const B = randomUUID();
  const C = randomUUID();
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  let db: any;
  let schema: any;
  let sqlClient: any;
  let signToken: any;
  let profileChannelId: any;
  let server: StreamChat;
  let aToken = '';
  let bToken = '';
  let cToken = '';
  let channelId = '';
  let staleChannelId = '';
  let clientA: StreamChat | null = null;
  let clientB: StreamChat | null = null;
  let restartedB: StreamChat | null = null;

  async function call(userToken: string, path: string, method = 'GET', body?: unknown) {
    const response = await app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${userToken}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : {} };
  }

  const ref = (id: string) => ({ id, type: 'personal' as const });
  const followBody = (follower: string, followed: string) => ({
    followerProfileId: follower,
    followerProfileType: 'personal',
    followedProfileId: followed,
    followedProfileType: 'personal',
  });

  before(async () => {
    const [{ Hono }, auth, client, dbSchema, follows, messages, streamService] = await Promise.all([
      import('hono'),
      import('../lib/auth.js'),
      import('../db/client.js'),
      import('../db/schema.js'),
      import('./profile-follows.js'),
      import('./messages.js'),
      import('../messages/StreamChatService.js'),
    ]);
    db = client.db;
    sqlClient = client.sql;
    schema = dbSchema;
    signToken = auth.signToken;
    profileChannelId = streamService.profileChannelId;
    const hono = new Hono();
    hono.route('/v1/profile-follows', follows.profileFollowRoutes);
    hono.route('/v1/messages', messages.messagesRoutes);
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: A, phone: `+91dm${A.slice(0, 8)}`, displayName: 'Arun E2E' },
      { id: B, phone: `+91dm${B.slice(0, 8)}`, displayName: 'Bala E2E', isPrivate: true },
      { id: C, phone: `+91dm${C.slice(0, 8)}`, displayName: 'Chitra E2E' },
    ]);
    [aToken, bToken, cToken] = await Promise.all([A, B, C].map(id => signToken({
      sub: id, email: '', name: id, roles: [], kind: 'mobile',
    })));
    server = StreamChat.getInstance(process.env.STREAM_API_KEY!, process.env.STREAM_API_SECRET!);
    channelId = profileChannelId(ref(A), ref(B));
    staleChannelId = profileChannelId(ref(A), ref(C));
  });

  after(async () => {
    await Promise.all([
      clientA?.disconnectUser().catch(() => undefined),
      clientB?.disconnectUser().catch(() => undefined),
      restartedB?.disconnectUser().catch(() => undefined),
    ]);
    try { await server.channel('messaging', channelId).delete({ hard_delete: true }); } catch {}
    try { await server.channel('messaging', staleChannelId).delete({ hard_delete: true }); } catch {}
    try { await server.deleteUsers([A, B, C], { user: 'hard', messages: 'hard' }); } catch {}
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.directMessageReports).where(inArray(schema.directMessageReports.reporterUserId, [A, B, C]));
    await db.delete(schema.profileBlocks).where(inArray(schema.profileBlocks.blockerProfileId, [A, B, C]));
    await db.delete(schema.profileFollows).where(inArray(schema.profileFollows.followerProfileId, [A, B, C]));
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [A, B, C]));
    await sqlClient.end({ timeout: 5 });
  });

  it('enforces eligibility, creates once, delivers live, reads, reconnects, reports and blocks', async () => {
    const beforeFollow = await call(aToken, '/v1/messages/channels', 'POST', { viewerProfile: ref(A), otherProfile: ref(B) });
    assert.equal(beforeFollow.status, 403);

    const requested = await call(aToken, '/v1/profile-follows', 'POST', followBody(A, B));
    assert.equal(requested.status, 202, JSON.stringify(requested.body));
    const stillPending = await call(aToken, '/v1/messages/channels', 'POST', { viewerProfile: ref(A), otherProfile: ref(B) });
    assert.equal(stillPending.status, 403);

    const accepted = await call(bToken, `/v1/profile-follows/requests/personal/${B}/accept`, 'POST', ref(A));
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));

    const [aSession, bSession] = await Promise.all([
      call(aToken, '/v1/messages/token', 'POST', {}),
      call(bToken, '/v1/messages/token', 'POST', {}),
    ]);
    assert.equal(aSession.status, 200, JSON.stringify(aSession.body));
    assert.equal(bSession.status, 200, JSON.stringify(bSession.body));

    const streamChannel = server.channel('messaging', channelId);
    const state = await streamChannel.query({ messages: { limit: 20 } });
    assert.deepEqual(new Set(state.members.map(member => member.user_id)), new Set([A, B]));
    assert.equal(state.messages.filter(message => (message as any).automatic_welcome).length, 1);

    const opened = await call(aToken, '/v1/messages/channels', 'POST', { viewerProfile: ref(A), otherProfile: ref(B) });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.channelId, channelId);
    const afterOpen = await streamChannel.query({ messages: { limit: 20 } });
    assert.equal(afterOpen.messages.filter(message => (message as any).automatic_welcome).length, 1);

    const unfollowed = await call(aToken, '/v1/profile-follows', 'DELETE', followBody(A, B));
    assert.equal(unfollowed.status, 200, JSON.stringify(unfollowed.body));
    const requestedAgain = await call(aToken, '/v1/profile-follows', 'POST', followBody(A, B));
    assert.equal(requestedAgain.status, 202, JSON.stringify(requestedAgain.body));
    const acceptedAgain = await call(bToken, `/v1/profile-follows/requests/personal/${B}/accept`, 'POST', ref(A));
    assert.equal(acceptedAgain.status, 200, JSON.stringify(acceptedAgain.body));
    const restoredPair = await streamChannel.query({ messages: { limit: 20 } });
    assert.deepEqual(new Set(restoredPair.members.map(member => member.user_id)), new Set([A, B]));
    assert.equal(restoredPair.messages.filter(message => (message as any).automatic_welcome).length, 1);

    clientA = new StreamChat(process.env.STREAM_API_KEY!);
    clientB = new StreamChat(process.env.STREAM_API_KEY!);
    await Promise.all([
      clientA.connectUser({ id: A }, server.createToken(A)),
      clientB.connectUser({ id: B }, server.createToken(B)),
    ]);
    const aChannel = clientA.channel('messaging', channelId);
    const bChannel = clientB.channel('messaging', channelId);
    await Promise.all([aChannel.watch(), bChannel.watch()]);
    const [aInbox, bInbox] = await Promise.all([
      clientA.queryChannels({ type: 'messaging', members: { $in: [A] } }),
      clientB.queryChannels({ type: 'messaging', members: { $in: [B] } }),
    ]);
    assert.equal(aInbox.some(item => item.id === channelId), true);
    assert.equal(bInbox.some(item => item.id === channelId), true);
    const liveMessage = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('message.new was not delivered')), 10_000);
      const listener = bChannel.on('message.new', event => {
        if (event.message?.text === 'Hello from E2E') {
          clearTimeout(timeout);
          listener.unsubscribe();
          resolve(event.message.id);
        }
      });
    });
    const sent = await aChannel.sendMessage({ text: 'Hello from E2E' });
    assert.equal(await liveMessage, sent.message.id);
    assert.equal(bChannel.countUnread() > 0, true);

    const readReceipt = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('message.read was not delivered')), 10_000);
      const listener = aChannel.on('message.read', event => {
        if (event.user?.id === B) {
          clearTimeout(timeout);
          listener.unsubscribe();
          resolve();
        }
      });
    });
    await bChannel.markRead();
    await readReceipt;

    await clientB.disconnectUser();
    restartedB = new StreamChat(process.env.STREAM_API_KEY!);
    await restartedB.connectUser({ id: B }, server.createToken(B));
    const restored = restartedB.channel('messaging', channelId);
    await restored.watch();
    assert.equal(restored.state.messages.some(message => message.text === 'Hello from E2E'), true);

    const report = await call(bToken, `/v1/messages/channels/${channelId}/report`, 'POST', {
      viewerProfile: ref(B), otherProfile: ref(A), reason: 'spam',
    });
    assert.equal(report.status, 201, JSON.stringify(report.body));

    const unrelated = await call(cToken, '/v1/messages/channels', 'POST', { viewerProfile: ref(C), otherProfile: ref(A) });
    assert.equal(unrelated.status, 403);

    const cSession = await call(cToken, '/v1/messages/token', 'POST', {});
    assert.equal(cSession.status, 200, JSON.stringify(cSession.body));

    const stale = server.channel('messaging', staleChannelId, {
      members: [A, C],
      created_by_id: A,
      profile_members: [
        { user_id: A, profile_id: A, profile_type: 'personal', name: 'Arun E2E' },
        { user_id: C, profile_id: C, profile_type: 'personal', name: 'Chitra E2E' },
      ],
    } as any);
    await stale.create();
    const reconciled = await call(cToken, '/v1/messages/token', 'POST', {});
    assert.equal(reconciled.status, 200, JSON.stringify(reconciled.body));
    const staleState = await stale.query({ messages: { limit: 1 } });
    assert.equal(staleState.channel.frozen, true);
    assert.equal(staleState.members.length, 0);

    const blocked = await call(bToken, '/v1/profile-follows/blocks', 'POST', followBody(B, A));
    assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
    const frozen = await streamChannel.query({ messages: { limit: 1 } });
    assert.equal(frozen.channel.frozen, true);
    await assert.rejects(() => aChannel.sendMessage({ text: 'Must not send after block' }));

    await Promise.all([clientA.disconnectUser(), restartedB.disconnectUser()]);
    clientA = null;
    clientB = null;
    restartedB = null;
  });
});
