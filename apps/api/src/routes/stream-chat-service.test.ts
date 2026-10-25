import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { profileChannelId, StreamChatService } from '../messages/StreamChatService.js';

const A = { id: '3ecdda28-0747-4357-aa2c-6c2e67f6e861', type: 'personal' as const, name: 'Arun', image: null };
const B = { id: '5ce8f64d-0747-4357-aa2c-6c2e67f6e862', type: 'business' as const, name: 'Bala Studio', image: null };

function fakeStream() {
  const sent: Array<{ message: any; options: any }> = [];
  const hidden: string[] = [];
  const channel: any = {
    id: profileChannelId(A, B),
    data: {},
    state: { members: { [A.id]: {}, [B.id]: {} } },
    async create() { return {}; },
    async addMembers() { return {}; },
    async removeMembers() { return {}; },
    async updatePartial(update: any) {
      channel.data = { ...channel.data, ...(update.set ?? {}) };
      return { channel: channel.data };
    },
    async show() { return {}; },
    async hide(userId: string) { hidden.push(userId); return {}; },
    async sendMessage(message: any, options: any) { sent.push({ message, options }); return {}; },
  };
  const client: any = {
    async upsertUsers() { return {}; },
    channel() { return channel; },
    async queryChannels() { return [channel]; },
  };
  return { client, channel, sent, hidden };
}

describe('Stream direct conversations', () => {
  it('uses one symmetric id and sends one quiet automatic welcome', async () => {
    assert.equal(profileChannelId(A, B), profileChannelId(B, A));
    const stream = fakeStream();
    const service = new StreamChatService(stream.client);
    const input = {
      viewerUserId: A.id,
      targetUserId: B.id,
      viewerProfile: A,
      targetProfile: B,
    };
    await service.createOrGetProfileChannel(input);
    await service.createOrGetProfileChannel(input);

    assert.equal(stream.sent.length, 1);
    assert.equal(stream.sent[0].message.type, 'system');
    assert.match(stream.sent[0].message.text, /now connected.*hello/iu);
    assert.equal(stream.sent[0].options.skip_push, true);
    assert.equal(stream.channel.data.welcome_message_sent, true);
    assert.equal(stream.channel.data.frozen, false);
  });

  it('freezes and hides an ineligible conversation without deleting history', async () => {
    const stream = fakeStream();
    const service = new StreamChatService(stream.client);
    const suspended = await service.suspendProfileChannel({
      firstUserId: A.id,
      secondUserId: B.id,
      firstProfile: A,
      secondProfile: B,
    });
    assert.equal(suspended, true);
    assert.equal(stream.channel.data.frozen, true);
    assert.deepEqual(stream.hidden.sort(), [A.id, B.id].sort());
  });
});
