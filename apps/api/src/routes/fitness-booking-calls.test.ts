import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;
describe(
  "Scheduled fitness consultation call authorization (PostgreSQL; no calls placed)",
  { skip: !testDatabase },
  () => {
    const customer = randomUUID(),
      trainer = randomUUID(),
      nutritionist = randomUUID(),
      admin = randomUUID(),
      creator = randomUUID(),
      stranger = randomUUID();
    const trainerId = randomUUID(),
      nutritionId = randomUUID(),
      trainerApp = randomUUID(),
      nutritionApp = randomUUID(),
      trainerBooking = randomUUID(),
      nutritionBooking = randomUUID();
    const userIds = [customer, trainer, nutritionist, admin, creator, stranger];
    const now = new Date("2026-11-14T10:00:00Z"),
      run = randomUUID();
    let db: any, client: any, schema: any, authorize: any;
    const customerInput = (
      providerId = trainerId,
      bookingId = trainerBooking
    ) => ({
      bookingId,
      userId: customer,
      viewer: { id: customer, type: "personal" },
      target: { id: providerId, type: "business" },
    });
    const providerInput = (
      userId = trainer,
      providerId = trainerId,
      bookingId = trainerBooking
    ) => ({
      bookingId,
      userId,
      viewer: { id: providerId, type: "business" },
      target: { id: customer, type: "personal" },
    });
    before(async () => {
      const connection = await import("../db/client.js");
      db = connection.db;
      client = connection.sql;
      schema = await import("../db/schema.js");
      authorize = (await import("../messages/bookingCallAuthorization.js"))
        .bookingCallIsAuthorized;
      await db
        .insert(schema.mobileUsers)
        .values(
          userIds.map((id, index) => ({
            id,
            phone: `fitness-calls-${run}-${index}`,
            displayName: [
              "Customer",
              "Trainer",
              "Nutritionist",
              "Business admin",
              "Creator",
              "Stranger",
            ][index],
          }))
        );
      // Older approved sources deliberately have no fitness qualification payload. General booking calls remain valid.
      await db.insert(schema.providerApplications).values([
        {
          id: trainerApp,
          mobileUserId: trainer,
          providerKind: "individual",
          status: "approved",
        },
        {
          id: nutritionApp,
          mobileUserId: nutritionist,
          providerKind: "individual",
          status: "approved",
        },
      ]);
      await db.insert(schema.providers).values([
        {
          id: trainerId,
          mobileUserId: trainer,
          providerKind: "individual",
          name: "Trainer",
          sourceApplicationId: trainerApp,
        },
        {
          id: nutritionId,
          mobileUserId: nutritionist,
          providerKind: "individual",
          name: "Nutritionist",
          sourceApplicationId: nutritionApp,
        },
      ]);
      await db.insert(schema.providerMemberships).values([
        { providerId: trainerId, mobileUserId: admin, role: "admin" },
        {
          providerId: trainerId,
          mobileUserId: creator,
          role: "content_creator",
        },
      ]);
      await db.insert(schema.bookings).values(
        [
          { id: trainerBooking, providerId: trainerId },
          { id: nutritionBooking, providerId: nutritionId },
        ].map((row) => ({
          ...row,
          mobileUserId: customer,
          category: "Fitness",
          status: "confirmed",
          serviceMode: "online",
          startsAt: now,
          durationMinutes: 30,
          detail: {},
        }))
      );
    });
    after(async () => {
      if (!db) return;
      try {
        const { inArray } = await import("drizzle-orm");
        await db
          .delete(schema.mobileUsers)
          .where(inArray(schema.mobileUsers.id, userIds));
      } finally {
        await client.end({ timeout: 5 });
      }
    });
    it("authorizes the booked customer and direct owner without needing a membership row", async () => {
      assert.equal(await authorize(customerInput(), now), true);
      assert.equal(await authorize(providerInput(), now), true);
      assert.equal(
        await authorize(customerInput(nutritionId, nutritionBooking), now),
        true
      );
      assert.equal(
        await authorize(
          providerInput(nutritionist, nutritionId, nutritionBooking),
          now
        ),
        true
      );
    });
    it("accepts a business admin and denies creators, unrelated users and wrong identities", async () => {
      assert.equal(await authorize(providerInput(admin), now), true);
      assert.equal(await authorize(providerInput(creator), now), false);
      assert.equal(await authorize(providerInput(stranger), now), false);
      assert.equal(
        await authorize({ ...customerInput(), userId: stranger }, now),
        false
      );
      assert.equal(
        await authorize(
          { ...providerInput(), target: { id: stranger, type: "personal" } },
          now
        ),
        false
      );
      assert.equal(
        await authorize(
          { ...providerInput(), viewer: { id: nutritionId, type: "business" } },
          now
        ),
        false
      );
      assert.equal(
        await authorize({ ...customerInput(), bookingId: randomUUID() }, now),
        false
      );
    });
    it("enforces confirmed, online and exact opening/closing time boundaries using an injected clock", async () => {
      const { eq } = await import("drizzle-orm");
      assert.equal(
        await authorize(customerInput(), new Date(now.getTime() - 15 * 60000)),
        true
      );
      assert.equal(
        await authorize(
          customerInput(),
          new Date(now.getTime() - 15 * 60000 - 1)
        ),
        false
      );
      assert.equal(
        await authorize(customerInput(), new Date(now.getTime() + 60 * 60000)),
        true
      );
      assert.equal(
        await authorize(
          customerInput(),
          new Date(now.getTime() + 60 * 60000 + 1)
        ),
        false
      );
      for (const status of ["cancelled", "pending", "completed"]) {
        await db
          .update(schema.bookings)
          .set({ status })
          .where(eq(schema.bookings.id, trainerBooking));
        assert.equal(await authorize(customerInput(), now), false);
      }
      await db
        .update(schema.bookings)
        .set({ status: "confirmed", serviceMode: "center" })
        .where(eq(schema.bookings.id, trainerBooking));
      assert.equal(await authorize(customerInput(), now), false);
      await db
        .update(schema.bookings)
        .set({ serviceMode: "online" })
        .where(eq(schema.bookings.id, trainerBooking));
    });
    it("rechecks approved source, provider status and both participant accounts", async () => {
      const { eq } = await import("drizzle-orm");
      await db
        .update(schema.providerApplications)
        .set({ status: "rejected" })
        .where(eq(schema.providerApplications.id, trainerApp));
      assert.equal(await authorize(customerInput(), now), false);
      await db
        .update(schema.providerApplications)
        .set({ status: "approved" })
        .where(eq(schema.providerApplications.id, trainerApp));
      await db
        .update(schema.providers)
        .set({ status: "deleted" })
        .where(eq(schema.providers.id, trainerId));
      assert.equal(await authorize(customerInput(), now), false);
      await db
        .update(schema.providers)
        .set({ status: "active" })
        .where(eq(schema.providers.id, trainerId));
      for (const userId of [customer, trainer, admin]) {
        await db
          .update(schema.mobileUsers)
          .set({ isActive: false })
          .where(eq(schema.mobileUsers.id, userId));
        assert.equal(
          await authorize(
            userId === admin ? providerInput(admin) : customerInput(),
            now
          ),
          false
        );
        await db
          .update(schema.mobileUsers)
          .set({ isActive: true })
          .where(eq(schema.mobileUsers.id, userId));
      }
    });
    it("denies provider, owner and staff account blocks in either direction", async () => {
      const { eq } = await import("drizzle-orm");
      for (const block of [
        { blockerMobileUserId: customer, blockedProviderId: trainerId },
        { blockerMobileUserId: customer, blockedMobileUserId: trainer },
        { blockerMobileUserId: trainer, blockedMobileUserId: customer },
        { blockerMobileUserId: admin, blockedMobileUserId: customer },
        { blockerMobileUserId: customer, blockedMobileUserId: admin },
      ]) {
        const [inserted] = await db
          .insert(schema.mobileUserBlocks)
          .values(block)
          .returning();
        assert.equal(await authorize(providerInput(admin), now), false);
        await db
          .delete(schema.mobileUserBlocks)
          .where(eq(schema.mobileUserBlocks.id, inserted.id));
      }
    });
    it("denies profile blocks on the chosen business identity and staff personal account", async () => {
      const { eq } = await import("drizzle-orm");
      for (const block of [
        {
          blockerProfileId: customer,
          blockerProfileType: "personal",
          blockedProfileId: trainerId,
          blockedProfileType: "business",
        },
        {
          blockerProfileId: trainerId,
          blockerProfileType: "business",
          blockedProfileId: customer,
          blockedProfileType: "personal",
        },
        {
          blockerProfileId: admin,
          blockerProfileType: "personal",
          blockedProfileId: customer,
          blockedProfileType: "personal",
        },
      ]) {
        const [inserted] = await db
          .insert(schema.profileBlocks)
          .values(block)
          .returning();
        assert.equal(await authorize(providerInput(admin), now), false);
        await db
          .delete(schema.profileBlocks)
          .where(eq(schema.profileBlocks.id, inserted.id));
      }
      assert.equal(await authorize(providerInput(admin), now), true);
    });
  }
);
