import { createHash } from 'node:crypto';
import { StreamChat } from 'stream-chat';
import { db } from '../db/client.js';
import { mobileUsers } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { PublisherProfileType } from '@anticlock/contracts';

export class StreamChatService {
  constructor(private client: StreamChat) {}

  /**
   * Upsert user in Stream and generate token
   */
  async createUserToken(userId: string): Promise<string> {
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
    viewerProfile: { id: string; type: PublisherProfileType; name: string; image: string | null };
    targetProfile: { id: string; type: PublisherProfileType; name: string; image: string | null };
  }): Promise<string> {
    if (input.viewerUserId === input.targetUserId) {
      throw new Error('Cannot create conversation with yourself');
    }
    const members = [input.viewerUserId, input.targetUserId].sort();
    const profilePair = [
      `${input.viewerProfile.type}:${input.viewerProfile.id}`,
      `${input.targetProfile.type}:${input.targetProfile.id}`,
    ].sort();
    const channelId = `profile-${createHash('sha256').update(profilePair.join('|')).digest('hex').slice(0, 48)}`;
    const channel = this.client.channel('messaging', channelId, {
      members,
      profile_members: [
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
      ],
    } as any);
    await channel.create();
    return channel.id as string;
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
