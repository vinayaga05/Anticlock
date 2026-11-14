import { and, desc, eq, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import {
  ComplaintListQuerySchema,
  CreateComplaintRequestSchema,
  type Complaint,
  type ComplaintListQuery,
  type CreateComplaintRequest,
  type ListComplaintsResponse,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { complaints, mobileUsers } from '../db/schema.js';
import { ApiError } from '../lib/httpError.js';

const CursorSchema = z.object({
  createdAt: z.string().datetime(),
  id: z.string().uuid(),
});

export function encodeComplaintCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id })).toString('base64url');
}

export function decodeComplaintCursor(value: string): { createdAt: Date; id: string } {
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid encoding');
    const parsed = CursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime())) throw new Error('Invalid date');
    return { createdAt, id: parsed.id };
  } catch {
    throw new ApiError(400, 'invalid_cursor', 'The complaints cursor is invalid. Refresh the list.');
  }
}

type ComplaintRow = typeof complaints.$inferSelect;
type PublicAuthor = { id: string; displayName: string; avatarUrl: string | null };

function presentComplaint(row: ComplaintRow, author: PublicAuthor): Complaint {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    author: { id: author.id, displayName: author.displayName, avatarUrl: author.avatarUrl },
    createdAt: row.createdAt.toISOString(),
  };
}

export class ComplaintService {
  private async activeUser(userId: string): Promise<PublicAuthor> {
    if (!z.string().uuid().safeParse(userId).success) {
      throw new ApiError(403, 'forbidden', 'An active mobile account is required.');
    }
    const [user] = await db.select({
      id: mobileUsers.id,
      displayName: mobileUsers.displayName,
      avatarUrl: mobileUsers.avatarUrl,
    }).from(mobileUsers).where(and(eq(mobileUsers.id, userId), eq(mobileUsers.isActive, true))).limit(1);
    if (!user) throw new ApiError(403, 'forbidden', 'An active mobile account is required.');
    return user;
  }

  async listComplaints(viewerId: string, query: Partial<ComplaintListQuery> = {}): Promise<ListComplaintsResponse> {
    const options = ComplaintListQuerySchema.parse(query);
    const cursor = options.cursor ? decodeComplaintCursor(options.cursor) : null;
    await this.activeUser(viewerId);
    const rows = await db.select({
      complaint: complaints,
      author: { id: mobileUsers.id, displayName: mobileUsers.displayName, avatarUrl: mobileUsers.avatarUrl },
    }).from(complaints)
      .innerJoin(mobileUsers, eq(complaints.authorId, mobileUsers.id))
      .where(cursor ? or(
        lt(complaints.createdAt, cursor.createdAt),
        and(eq(complaints.createdAt, cursor.createdAt), lt(complaints.id, cursor.id)),
      ) : undefined)
      .orderBy(desc(complaints.createdAt), desc(complaints.id))
      .limit(options.limit + 1);
    const hasMore = rows.length > options.limit;
    const visible = rows.slice(0, options.limit);
    const last = visible.at(-1);
    return {
      complaints: visible.map(row => presentComplaint(row.complaint, row.author)),
      nextCursor: hasMore && last ? encodeComplaintCursor(last.complaint) : null,
    };
  }

  async createComplaint(authorId: string, input: CreateComplaintRequest): Promise<Complaint> {
    const request = CreateComplaintRequestSchema.parse(input);
    const author = await this.activeUser(authorId);
    const [created] = await db.insert(complaints).values({
      authorId,
      title: request.title,
      description: request.description,
      clientRequestId: request.clientRequestId ?? null,
    }).onConflictDoNothing({ target: [complaints.authorId, complaints.clientRequestId] }).returning();
    if (created) return presentComplaint(created, author);

    // The unique index serializes concurrent retries for the same author/key.
    const [original] = await db.select().from(complaints).where(and(
      eq(complaints.authorId, authorId),
      eq(complaints.clientRequestId, request.clientRequestId!),
    )).limit(1);
    if (!original || original.title !== request.title || original.description !== request.description) {
      throw new ApiError(409, 'idempotency_conflict', 'This request was already used for another complaint. Start a new complaint.');
    }
    return presentComplaint(original, author);
  }
}

export const complaintService = new ComplaintService();
