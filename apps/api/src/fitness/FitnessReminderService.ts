import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import type { FitnessAssessment, FitnessSummary } from "@anticlock/contracts";
import { db } from "../db/client.js";
import {
  bookings,
  fitnessProfiles,
  mobileUsers,
  providers,
} from "../db/schema.js";
import {
  notificationService,
  type NotifyUserPayload,
} from "../notifications/NotificationService.js";
import { decryptFitnessData } from "./privacy.js";
import { fitnessService } from "./FitnessService.js";
import { fitnessExpertService } from "./FitnessExpertService.js";
import { fitnessDateInZone, shiftFitnessDate } from "./aggregates.js";

export type FitnessReminder = NotifyUserPayload & {
  idempotencyKey: string;
  data: Record<string, unknown>;
};
type ReminderKind = "workouts" | "meals" | "water" | "habits" | "weeklySummary";
const defaults: Record<ReminderKind, string> = {
  workouts: "18:00",
  meals: "13:00",
  water: "11:00",
  habits: "20:00",
  weeklySummary: "18:00",
};
const timeFields = {
  workouts: "workoutTime",
  meals: "mealTime",
  water: "waterTime",
  habits: "habitTime",
  weeklySummary: "weeklySummaryTime",
} as const;
function reminderCandidates(
  assessment: FitnessAssessment,
  now: Date
): Array<{ kind: ReminderKind; date: string; day: number; time: string }> {
  const config = assessment.reminders;
  if (!config?.enabled) return [];
  const timezone = assessment.timezone ?? "UTC",
    date = fitnessDateInZone(now, timezone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const number = (key: string) =>
    Number(parts.find((p) => p.type === key)?.value ?? 0);
  const minute = number("hour") * 60 + number("minute") + number("second") / 60;
  const candidates: Array<{
    kind: ReminderKind;
    date: string;
    day: number;
    time: string;
  }> = [];
  for (const kind of Object.keys(defaults) as ReminderKind[]) {
    if (!config[kind]) continue;
    const time = config[timeFields[kind]] ?? defaults[kind];
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
    const [h, m] = time.split(":").map(Number),
      scheduled = h! * 60 + m!;
    let elapsed = minute - scheduled,
      eventDate = date;
    if (elapsed < 0) {
      elapsed += 1440;
      eventDate = shiftFitnessDate(date, -1);
    }
    if (elapsed < 0 || elapsed >= 10) continue;
    const day = new Date(`${eventDate}T12:00:00Z`).getUTCDay();
    if (kind === "weeklySummary" && day !== 0) continue;
    candidates.push({ kind, date: eventDate, day, time });
  }
  return candidates;
}
/** Pure wall-clock planning. All health information remains outside notification text/data. */
export function collectFitnessReminders(
  assessment: FitnessAssessment,
  summary: FitnessSummary,
  now: Date
): FitnessReminder[] {
  if (summary.profile?.status !== "complete" || !assessment.reminders?.enabled)
    return [];
  const result: FitnessReminder[] = [];
  for (const candidate of reminderCandidates(assessment, now)) {
    const { kind, date, day, time } = candidate;
    let type: FitnessReminder["type"],
      screen: string,
      data: Record<string, unknown> = {},
      body: string;
    if (kind === "workouts") {
      const plan = summary.plan;
      if (
        !plan ||
        plan.status !== "active" ||
        plan.content.requiresProfessionalReview ||
        !plan.content.workouts.some((workout) => workout.day === day)
      )
        continue;
      if (summary.weekly.days.find((d) => d.date === date)?.workouts) continue;
      type = "fitness_workout_reminder";
      screen = "FitnessWorkout";
      data = { planId: plan.id, day };
      body = "Your planned session is ready when you are.";
    } else if (kind === "meals") {
      type = "fitness_meal_reminder";
      screen = "FitnessMeals";
      body = "Open your daily check-in when it suits you.";
    } else if (kind === "water") {
      type = "fitness_water_reminder";
      screen = "FitnessLog";
      data = { logKind: "water" };
      body = "A quick daily check-in is available.";
    } else if (kind === "habits") {
      type = "fitness_habit_reminder";
      screen = "FitnessLog";
      data = { logKind: "habit" };
      body = "Take a moment for your daily check-in.";
    } else {
      type = "fitness_weekly_summary";
      screen = "FitnessProgress";
      data = { from: shiftFitnessDate(date, -6), to: date };
      body = "Your weekly check-in is ready to review.";
    }
    result.push({
      type,
      title: "Your wellness check-in",
      body,
      data: { kind: "fitness", screen, date, ...data },
      idempotencyKey: `fitness-reminder:v1:${kind}:${date}:${time}:${
        kind === "workouts" ? summary.plan!.id : ""
      }`,
    });
  }
  return result;
}

type ProfilePage = { id: string; userId: string; encryptedData: string }[];
type DueBooking = {
  id: string;
  userId: string;
  providerId: string;
  providerOwnerId: string;
  startsAt: Date;
};
export type FitnessReminderDependencies = {
  now: () => Date;
  profiles: (cursor?: string) => Promise<ProfilePage>;
  summary: (
    userId: string,
    date: string,
    timezone: string
  ) => Promise<FitnessSummary>;
  notify: (userId: string, reminder: FitnessReminder) => Promise<unknown>;
  dueBookings: (now: Date) => Promise<DueBooking[]>;
  eligibleConsultations: (
    userId: string,
    providerView: boolean
  ) => Promise<Array<{ bookingId: string; canJoin: boolean }>>;
};
const defaultDependencies: FitnessReminderDependencies = {
  now: () => new Date(),
  profiles: async (cursor) =>
    db
      .select({
        id: fitnessProfiles.id,
        userId: fitnessProfiles.userId,
        encryptedData: fitnessProfiles.encryptedData,
      })
      .from(fitnessProfiles)
      .innerJoin(mobileUsers, eq(fitnessProfiles.userId, mobileUsers.id))
      .where(
        and(
          eq(fitnessProfiles.status, "complete"),
          eq(fitnessProfiles.remindersEnabled, true),
          eq(mobileUsers.isActive, true),
          cursor ? gt(fitnessProfiles.id, cursor) : undefined
        )
      )
      .orderBy(asc(fitnessProfiles.id))
      .limit(100),
  summary: (userId, date, timezone) =>
    fitnessService.summary(userId, date, timezone),
  notify: (userId, reminder) =>
    notificationService.notifyUser(userId, reminder),
  dueBookings: async (now) =>
    db
      .select({
        id: bookings.id,
        userId: bookings.mobileUserId,
        providerId: providers.id,
        providerOwnerId: providers.mobileUserId,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .innerJoin(providers, eq(bookings.providerId, providers.id))
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .where(
        and(
          eq(bookings.status, "confirmed"),
          eq(bookings.serviceMode, "online"),
          eq(mobileUsers.isActive, true),
          gte(bookings.startsAt, new Date(now.getTime() - 600000)),
          lte(bookings.startsAt, new Date(now.getTime() + 600000))
        )
      )
      .orderBy(asc(bookings.startsAt))
      .limit(500),
  eligibleConsultations: (userId, providerView) =>
    fitnessExpertService.consultations(userId, providerView),
};
export class FitnessReminderService {
  private running = false;
  private readonly dependencies: FitnessReminderDependencies;
  constructor(overrides: Partial<FitnessReminderDependencies> = {}) {
    this.dependencies = { ...defaultDependencies, ...overrides };
  }
  async runOnce(): Promise<{
    skipped: boolean;
    reminders: number;
    consultations: number;
  }> {
    if (this.running) return { skipped: true, reminders: 0, consultations: 0 };
    this.running = true;
    let reminders = 0,
      consultations = 0;
    const now = this.dependencies.now();
    try {
      let cursor: string | undefined;
      for (let page = 0; page < 100; page++) {
        const profiles = await this.dependencies.profiles(cursor);
        if (!profiles.length) break;
        for (const row of profiles) {
          try {
            const { assessment } = decryptFitnessData<{
              assessment: FitnessAssessment;
            }>(row.userId, row.encryptedData);
            if (!reminderCandidates(assessment, now).length) continue;
            const timezone = assessment.timezone ?? "UTC",
              summary = await this.dependencies.summary(
                row.userId,
                fitnessDateInZone(now, timezone),
                timezone
              );
            // Re-read the current setting before delivery, including any opt-out since the initial page.
            for (const reminder of collectFitnessReminders(
              summary.profile?.assessment ?? {},
              summary,
              now
            )) {
              await this.dependencies.notify(row.userId, reminder);
              reminders++;
            }
          } catch {
            console.error("[fitness-reminders] user_failed");
          }
        }
        cursor = profiles.at(-1)!.id;
        if (profiles.length < 100) break;
      }
      for (const booking of await this.dependencies.dueBookings(now)) {
        try {
          const customer = await this.dependencies.eligibleConsultations(
            booking.userId,
            false
          );
          const provider = await this.dependencies.eligibleConsultations(
            booking.providerOwnerId,
            true
          );
          if (
            !customer.some((c) => c.bookingId === booking.id && c.canJoin) ||
            !provider.some((c) => c.bookingId === booking.id && c.canJoin)
          )
            continue;
          for (const userId of new Set([
            booking.userId,
            booking.providerOwnerId,
          ])) {
            await this.dependencies.notify(userId, {
              type: "fitness_consultation_starting",
              title: "Your scheduled session",
              body: "Your consultation is ready to join.",
              data: {
                kind: "fitness",
                screen: "FitnessConsultations",
                bookingId: booking.id,
                providerId: booking.providerId,
              },
              idempotencyKey: `fitness-consultation:v1:${
                booking.id
              }:${booking.startsAt.toISOString()}`,
            });
            consultations++;
          }
        } catch {
          console.error("[fitness-reminders] consultation_failed");
        }
      }
      return { skipped: false, reminders, consultations };
    } catch {
      console.error("[fitness-reminders] run_failed");
      return { skipped: false, reminders, consultations };
    } finally {
      this.running = false;
    }
  }
}
export const fitnessReminderService = new FitnessReminderService();
export function startFitnessReminderJob(): () => void {
  const tick = () => {
    void fitnessReminderService.runOnce();
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}
