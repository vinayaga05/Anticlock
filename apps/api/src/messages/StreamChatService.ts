import { createHash } from 'node:crypto';
import { StreamChat, type Channel } from 'stream-chat';
import { db } from '../db/client.js';
import { mobileUsers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { PublisherProfileType } from '@anticlock/contracts';

type ChatProfile = {
  id: string;
  type: PublisherProfileType;
  name: string;
  image: string | null;
};

export function profileChannelId(a: Pick<ChatProfile, 'id' | 'type'>, b: Pick<ChatProfile, 'id' | 'type'>) {
  const profilePair = [`${a.type}:${a.id}`, `${b.type}:${b.id}`].sort();
  return `profile-${createHash('sha256').update(profilePair.join('|')).digest('hex').slice(0, 48)}`;
}

function welcomeMessageId(channelId: string) {
  return `welcome-${createHash('sha256').update(channelId).digest('hex').slice(0, 40)}`;
}

export class StreamChatService {
  constructor(private client: StreamChat) {}

  /** Upsert the current account user in Stream Chat. */
  async syncUser(userId: string) {
    // Fetch user from our DB
    const [user] = await db
      .select({
        id: mobileUsers.id,
        displayName: mobileUsers.displayName,
        avatarUrl: mobileUsers.avatarUrl,
      })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    // Upsert user in Stream
    await this.client.upsertUser({
      id: user.id,
      name: user.displayName,
      image: user.avatarUrl || undefined,
    });

    return user;
  }

  async createUserToken(userId: string): Promise<string> {
    const user = await this.syncUser(userId);

    // Generate token
    const token = this.client.createToken(user.id);
    return token;
  }

  /**
   * Create or get a 1:1 messaging channel between two users
   */
  async createOrGetChannel(userId: string, otherUserId: string): Promise<string> {
    // Validate no self-chat
    if (userId === otherUserId) {
      throw new Error('Cannot create conversation with yourself');
    }

    // Validate other user exists in our DB
    const [otherUser] = await db
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, otherUserId))
      .limit(1);

    if (!otherUser) {
      throw new Error('Other user not found');
    }

    // Create deterministic channel ID (sorted user IDs to ensure consistency)
    const sortedIds = [userId, otherUserId].sort();
    const channelId = `${sortedIds[0]}_${sortedIds[1]}`;

    // Create or get channel
    const channel = this.client.channel('messaging', channelId, {
      members: [userId, otherUserId],
      created_by_id: userId,
    });

    await channel.create();

    return channel.id as string;
  }

  /**
   * Profile-scoped 1:1 channel. The Stream members remain account users, while
   * the deterministic channel identity preserves which publisher profiles
   * each side chose to represent.
   */
  async createOrGetProfileChannel(input: {
    viewerUserId: string;
    targetUserId: string;
    viewerProfile: ChatProfile;
    targetProfile: ChatProfile;
  }): Promise<string> {
    if (input.viewerUserId === input.targetUserId) {
      throw new Error('Cannot create conversation with yourself');
    }
    const members = [input.viewerUserId, input.targetUserId].sort();
    const channelId = profileChannelId(input.viewerProfile, input.targetProfile);
    const profileMembers = [
      {
        user_id: input.viewerUserId,
        profile_id: input.viewerProfile.id,
        profile_type: input.viewerProfile.type,
        name: input.viewerProfile.name,
        image: input.viewerProfile.image,
      },
      {
        user_id: input.targetUserId,
        profile_id: input.targetProfile.id,
        profile_type: input.targetProfile.type,
        name: input.targetProfile.name,
        image: input.targetProfile.image,
      },
    ];
    await this.client.upsertUsers([
      { id: input.viewerUserId, name: input.viewerProfile.name, image: input.viewerProfile.image || undefined },
      { id: input.targetUserId, name: input.targetProfile.name, image: input.targetProfile.image || undefined },
    ]);
    const channel = this.client.channel('messaging', channelId, {
      members,
      created_by_id: input.viewerUserId,
      profile_members: profileMembers,
    } as any);
    await channel.create();
    await channel.addMembers(members);
    await channel.updatePartial({ set: { frozen: false, profile_members: profileMembers } as any });
    await Promise.all(members.map(userId => channel.show(userId).catch(() => undefined)));

    if (!(channel.data as any)?.welcome_message_sent) {
      try {
        await channel.sendMessage({
          id: welcomeMessageId(channelId),
          type: 'system',
          text: `${input.viewerProfile.name} and ${input.targetProfile.name} are now connected. Say hello 👋`,
          user_id: input.viewerUserId,
          automatic_welcome: true,
        } as any, { skip_push: true });
      } catch (error: any) {
        // The deterministic message id is the final idempotency guard when two
        // reciprocal follows arrive at nearly the same time.
        const duplicate = error?.status === 409
          || error?.response?.status === 409
          || /already exists|duplicate message/i.test(String(error?.message ?? error?.response?.data?.message ?? ''));
        if (!duplicate) throw error;
      }
      await channel.updatePartial({ set: { welcome_message_sent: true } as any });
    }
    return channel.id as string;
  }

  /** Hide and freeze a direct channel without deleting its durable history. */
  async suspendChannel(channel: Channel, expectedUserIds: string[]) {
    await channel.updatePartial({ set: { frozen: true } });
    const memberIds = new Set(Object.keys(channel.state.members));
    const membersToRemove = expectedUserIds.filter(userId => memberIds.has(userId));
    await Promise.all(membersToRemove.map(userId => channel.hide(userId, false)));
    if (membersToRemove.length > 0) await channel.removeMembers(membersToRemove);
    return true;
  }

  async suspendProfileChannel(input: {
    firstUserId: string;
    secondUserId: string;
    firstProfile: Pick<ChatProfile, 'id' | 'type'>;
    secondProfile: Pick<ChatProfile, 'id' | 'type'>;
  }) {
    const channelId = profileChannelId(input.firstProfile, input.secondProfile);
    const channels = await this.client.queryChannels(
      { type: 'messaging', id: channelId },
      [],
      { limit: 1, state: true, watch: false },
    );
    const channel = channels[0];
    if (!channel) return false;
    return this.suspendChannel(channel, [input.firstUserId, input.secondUserId]);
  }

  /**
   * Check if user exists in our database
   */
  async userExists(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, userId))
      .limit(1);
    
    return !!user;
  }
}
