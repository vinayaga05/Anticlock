import { StreamChat } from 'stream-chat';
import { db } from '../db/client.js';
import { mobileUsers } from '../db/schema.js';
import { eq } from 'drizzle-orm';

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
