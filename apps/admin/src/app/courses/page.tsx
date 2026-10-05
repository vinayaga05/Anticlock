'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Course } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CoursesPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: () => apiFetch<{ courses: Course[] }>('/admin/courses'),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      apiFetch(`/admin/courses/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'courses'] });
      setSelectedCourse(null);
      setEditStatus('');
    },
  });

  function handleEdit(course: Course) {
    setSelectedCourse(course);
    setEditStatus(course.status);
  }

  function handleUpdate() {
    if (selectedCourse && editStatus) {
      updateMutation.mutate({ id: selectedCourse.id, status: editStatus });
    }
  }

  function formatPrice(price: number) {
    return `₹${(price / 100).toFixed(2)}`;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'published':
        return 'badge-success';
      case 'draft':
        return 'badge-warning';
      case 'archived':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  function getDifficultyBadgeClass(difficulty: string) {
    switch (difficulty) {
      case 'beginner':
        return 'badge-success';
      case 'intermediate':
        return 'badge-warning';
      case 'advanced':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Courses</h1>
      <p className="page-sub">
        Manage course catalog. View and update course details, lessons, and availability.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading courses…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.courses && data.courses.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Instructor</th>
                <th>Difficulty</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.courses.map(course => (
                <tr key={course.id}>
                  <td>
                    <strong>{course.name}</strong>
                    <div className="muted">{course.slug}</div>
                    <div className="muted">{course.shortDescription}</div>
                  </td>
                  <td>{course.instructorName}</td>
                  <td>
                    <span
                      className={`badge ${getDifficultyBadgeClass(course.difficulty)}`}
                    >
                      {course.difficulty}
                    </span>
                  </td>
                  <td>{course.durationHours}h</td>
                  <td>
                    <strong>{formatPrice(course.price)}</strong>
                    {course.compareAtPrice && (
                      <div className="muted strike">
                        {formatPrice(course.compareAtPrice)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(course.status)}`}>
                      {course.status}
                    </span>
                  </td>
                  <td>
                    {hasPermission('catalog.write') ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => handleEdit(course)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.courses && data.courses.length === 0 ? (
          <p className="muted">No courses found.</p>
        ) : null}
      </div>

      {selectedCourse && (
        <div className="modal-overlay" onClick={() => setSelectedCourse(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Course</h2>
            <div className="form-group">
              <label>Course Name</label>
              <p>{selectedCourse.name}</p>
            </div>
            <div className="form-group">
              <label>Instructor</label>
              <p>{selectedCourse.instructorName}</p>
            </div>
            <div className="form-group">
              <label>Difficulty</label>
              <p>{selectedCourse.difficulty}</p>
            </div>
            <div className="form-group">
              <label>Duration</label>
              <p>{selectedCourse.durationHours} hours</p>
            </div>
            <div className="form-group">
              <label>Price</label>
              <p>{formatPrice(selectedCourse.price)}</p>
            </div>
            <div className="form-group">
              <label>Learning Outcomes</label>
              <ul>
                {selectedCourse.learningOutcomes.map((outcome, idx) => (
                  <li key={idx}>{outcome}</li>
                ))}
              </ul>
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelectedCourse(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Updating…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
