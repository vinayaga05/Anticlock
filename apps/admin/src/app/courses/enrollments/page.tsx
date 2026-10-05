'use client';

import { useQuery } from '@tanstack/react-query';
import type { EnrollmentAdminListItem } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

export default function CourseEnrollmentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'courses', 'enrollments'],
    queryFn: () =>
      apiFetch<{ enrollments: EnrollmentAdminListItem[] }>(
        '/admin/courses/enrollments',
      ),
  });

  function formatPrice(price: number) {
    return `₹${(price / 100).toFixed(2)}`;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'completed':
        return 'badge-info';
      case 'dropped':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  function getPaymentStatusBadgeClass(status: string) {
    switch (status) {
      case 'paid':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'failed':
        return 'badge-error';
      case 'refunded':
        return 'badge-info';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Course Enrollments</h1>
      <p className="page-sub">
        View all course enrollments and track learner progress.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading enrollments…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.enrollments && data.enrollments.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Progress</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map(enrollment => (
                <tr key={enrollment.id}>
                  <td>
                    <strong>{enrollment.userName}</strong>
                    <div className="muted">{enrollment.userPhone}</div>
                  </td>
                  <td>
                    <strong>{enrollment.courseName}</strong>
                  </td>
                  <td>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${enrollment.totalLessonsCount > 0 ? (enrollment.completedLessonsCount / enrollment.totalLessonsCount) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <div className="muted">
                      {enrollment.completedLessonsCount} /{' '}
                      {enrollment.totalLessonsCount} lessons
                    </div>
                  </td>
                  <td>
                    <div>{formatPrice(enrollment.paymentAmount)}</div>
                    <span
                      className={`badge ${getPaymentStatusBadgeClass(enrollment.paymentStatus)}`}
                    >
                      {enrollment.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(enrollment.status)}`}
                    >
                      {enrollment.status}
                    </span>
                  </td>
                  <td>
                    {new Date(enrollment.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.enrollments && data.enrollments.length === 0 ? (
          <p className="muted">No enrollments found.</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
