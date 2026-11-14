import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  bookings,
  mobileUserBlocks,
  mobileUsers,
  providerMemberships,
} from "../db/schema.js";
import { ApiError } from "../lib/httpError.js";
import { businessProfileService } from "../provider/BusinessProfileService.js";
import type { PublisherRef } from "../publishing/publisher.js";
import { profilesAreBlocked } from "../social/ProfileFollowService.js";

/** Booking calls inherit the current business lifecycle, participant and safety gates. */
export async function bookingCallIsAuthorized(
  input: {
    bookingId: string;
    userId: string;
    viewer: PublisherRef;
    target: PublisherRef;
  },
  now = new Date()
): Promise<boolean> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, input.bookingId),
        eq(bookings.status, "confirmed"),
        eq(bookings.serviceMode, "online")
      )
    )
    .limit(1);
  if (!booking?.providerId) return false;
  const start = booking.startsAt.getTime();
  const end =
    booking.endsAt?.getTime() ??
    start + (booking.durationMinutes ?? 60) * 60_000;
  if (
    !Number.isFinite(now.getTime()) ||
    now.getTime() < start - 15 * 60_000 ||
    now.getTime() > end + 30 * 60_000
  )
    return false;
  const customer =
    booking.mobileUserId === input.userId &&
    input.viewer.type === "personal" &&
    input.viewer.id === booking.mobileUserId &&
    input.target.type === "business" &&
    input.target.id === booking.providerId;
  const business =
    input.viewer.type === "business" &&
    input.viewer.id === booking.providerId &&
    input.target.type === "personal" &&
    input.target.id === booking.mobileUserId;
  if (!customer && !business) return false;
  try {
    const provider = await businessProfileService.loadAvailable(
      booking.providerId,
      input.userId
    );
    // This rechecks both provider-profile and owner-account blocks, including the customer's direction.
    if (input.userId !== booking.mobileUserId)
      await businessProfileService.loadAvailable(
        booking.providerId,
        booking.mobileUserId
      );
    const [activeCustomer] = await db
      .select({ id: mobileUsers.id })
      .from(mobileUsers)
      .where(
        and(
          eq(mobileUsers.id, booking.mobileUserId),
          eq(mobileUsers.isActive, true)
        )
      )
      .limit(1);
    if (!activeCustomer) return false;
    if (await profilesAreBlocked(input.viewer, input.target)) return false;
    if (input.userId !== booking.mobileUserId) {
      if (
        await profilesAreBlocked(
          { id: input.userId, type: "personal" },
          { id: booking.mobileUserId, type: "personal" }
        )
      )
        return false;
      const [accountBlock] = await db
        .select({ id: mobileUserBlocks.id })
        .from(mobileUserBlocks)
        .where(
          sql`(${mobileUserBlocks.blockerMobileUserId} = ${input.userId} AND ${mobileUserBlocks.blockedMobileUserId} = ${booking.mobileUserId}) OR (${mobileUserBlocks.blockerMobileUserId} = ${booking.mobileUserId} AND ${mobileUserBlocks.blockedMobileUserId} = ${input.userId})`
        )
        .limit(1);
      if (accountBlock) return false;
    }
    if (customer || provider.mobileUserId === input.userId) return true;
    const [membership] = await db
      .select({ role: providerMemberships.role })
      .from(providerMemberships)
      .where(
        and(
          eq(providerMemberships.mobileUserId, input.userId),
          eq(providerMemberships.providerId, booking.providerId),
          inArray(providerMemberships.role, ["owner", "admin"])
        )
      )
      .limit(1);
    return Boolean(membership);
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status))
      return false;
    throw error;
  }
}
