import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Course,
  CourseWithLessons,
  CourseEnrollment,
  EnrollmentWithCourse,
} from '@anticlock/contracts';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';

function ensureAuthToken() {
  const session = readStoredSession();
  if (!session?.token) {
    throw new Error('Not authenticated');
  }
}

export function useCoursesQuery(options?: { difficulty?: string }) {
  return useQuery({
    queryKey: [
      'courses',
      'list',
      options?.difficulty ?? 'all',
      isApiEnabled ? 'api' : 'mock',
    ],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { courses: [], nextCursor: null };
      }
      await ensureAuthToken();
      const params = new URLSearchParams();
      if (options?.difficulty) params.append('difficulty', options.difficulty);
      
      const res = await apiRequest<{ courses: Course[]; nextCursor: string | null }>(
        `/v1/courses?${params.toString()}`,
      );
      return res;
    },
    staleTime: isApiEnabled ? 60_000 : Infinity,
  });
}

export function useCourseQuery(courseId: string) {
  return useQuery({
    queryKey: ['courses', 'detail', courseId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ course: CourseWithLessons }>(
        `/v1/courses/${courseId}`,
      );
      return res.course;
    },
    staleTime: isApiEnabled ? 60_000 : Infinity,
    enabled: !!courseId,
  });
}

export function useMyEnrollmentsQuery(status?: 'active' | 'completed' | 'dropped') {
  return useQuery({
    queryKey: ['courses', 'enrollments', status ?? 'all', isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { enrollments: [], nextCursor: null };
      }
      await ensureAuthToken();
      const qs = status ? `?status=${status}` : '';
      const res = await apiRequest<{
        enrollments: EnrollmentWithCourse[];
        nextCursor: string | null;
      }>(`/v1/courses/enrollments${qs}`);
      return res;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
  });
}

export function useEnrollmentQuery(enrollmentId: string) {
  return useQuery({
    queryKey: ['courses', 'enrollments', enrollmentId, isApiEnabled ? 'api' : 'mock'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return null;
      }
      await ensureAuthToken();
      const res = await apiRequest<{ enrollment: CourseEnrollment }>(
        `/v1/courses/enrollments/${enrollmentId}`,
      );
      return res.enrollment;
    },
    staleTime: isApiEnabled ? 30_000 : Infinity,
    enabled: !!enrollmentId,
  });
}

export function useEnrollCourseMutation(courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ enrollment: CourseEnrollment }>(
        `/v1/courses/${courseId}/enroll`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      return res.enrollment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses', 'enrollments'] });
    },
  });
}

export function useMarkLessonCompleteMutation(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { lessonId: string; progressPercent?: number }) => {
      if (!isApiEnabled) {
        throw new Error('API not enabled');
      }
      await ensureAuthToken();
      const res = await apiRequest<{ enrollment: CourseEnrollment }>(
        `/v1/courses/enrollments/${enrollmentId}/lessons/complete`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
      );
      return res.enrollment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses', 'enrollments'] });
      qc.invalidateQueries({ queryKey: ['courses', 'enrollments', enrollmentId] });
    },
  });
}
