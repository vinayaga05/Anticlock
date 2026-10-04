import { and, eq } from 'drizzle-orm';
import type {
  CourseLesson,
  CreateCourseLessonRequest,
  UpdateCourseLessonRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { courseLessons } from '../db/schema.js';

export class CourseLessonService {
  async createLesson(
    courseId: string,
    request: CreateCourseLessonRequest,
  ): Promise<CourseLesson> {
    const [row] = await db
      .insert(courseLessons)
      .values({
        courseId,
        moduleNumber: request.moduleNumber,
        moduleName: request.moduleName,
        lessonNumber: request.lessonNumber,
        title: request.title,
        description: request.description ?? null,
        type: request.type,
        durationMinutes: request.durationMinutes ?? null,
        contentUrl: request.contentUrl ?? null,
        contentText: request.contentText ?? null,
        mediaId: request.mediaId ?? null,
        sortOrder: request.sortOrder ?? 0,
        isFree: request.isFree ?? false,
      })
      .returning();

    return this.mapLessonRow(row!);
  }

  async getLesson(lessonId: string): Promise<CourseLesson | null> {
    const [row] = await db
      .select()
      .from(courseLessons)
      .where(eq(courseLessons.id, lessonId));

    return row ? this.mapLessonRow(row) : null;
  }

  async listLessons(courseId: string): Promise<CourseLesson[]> {
    const rows = await db
      .select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, courseId))
      .orderBy(courseLessons.sortOrder, courseLessons.moduleNumber, courseLessons.lessonNumber);

    return rows.map(row => this.mapLessonRow(row));
  }

  async updateLesson(
    lessonId: string,
    update: UpdateCourseLessonRequest,
  ): Promise<CourseLesson | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.moduleNumber) values.moduleNumber = update.moduleNumber;
    if (update.moduleName) values.moduleName = update.moduleName;
    if (update.lessonNumber) values.lessonNumber = update.lessonNumber;
    if (update.title) values.title = update.title;
    if (update.description !== undefined) values.description = update.description;
    if (update.type) values.type = update.type;
    if (update.durationMinutes !== undefined) values.durationMinutes = update.durationMinutes;
    if (update.contentUrl !== undefined) values.contentUrl = update.contentUrl;
    if (update.contentText !== undefined) values.contentText = update.contentText;
    if (update.mediaId !== undefined) values.mediaId = update.mediaId;
    if (update.sortOrder !== undefined) values.sortOrder = update.sortOrder;
    if (update.isFree !== undefined) values.isFree = update.isFree;

    const [row] = await db
      .update(courseLessons)
      .set(values)
      .where(eq(courseLessons.id, lessonId))
      .returning();

    return row ? this.mapLessonRow(row) : null;
  }

  async deleteLesson(lessonId: string): Promise<boolean> {
    const result = await db.delete(courseLessons).where(eq(courseLessons.id, lessonId));
    return true;
  }

  private mapLessonRow(row: typeof courseLessons.$inferSelect): CourseLesson {
    return {
      id: row.id,
      courseId: row.courseId,
      moduleNumber: row.moduleNumber,
      moduleName: row.moduleName,
      lessonNumber: row.lessonNumber,
      title: row.title,
      description: row.description ?? undefined,
      type: row.type as 'video' | 'article' | 'quiz' | 'exercise',
      durationMinutes: row.durationMinutes,
      contentUrl: row.contentUrl ?? undefined,
      contentText: row.contentText ?? undefined,
      mediaId: row.mediaId,
      sortOrder: row.sortOrder,
      isFree: row.isFree,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const courseLessonService = new CourseLessonService();
