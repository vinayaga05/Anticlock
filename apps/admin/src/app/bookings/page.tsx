'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BookingAdminListItem } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function BookingsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<BookingAdminListItem | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'bookings'],
    queryFn: () =>
      apiFetch<{ bookings: BookingAdminListItem[] }>('/admin/bookings'),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      apiFetch(`/admin/bookings/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bookings'] });
      setSelectedBooking(null);
      setEditStatus('');
    },
  });

  function handleEdit(booking: BookingAdminListItem) {
    setSelectedBooking(booking);
    setEditStatus(booking.status);
  }

  function handleUpdate() {
    if (selectedBooking && editStatus) {
      updateMutation.mutate({ id: selectedBooking.id, status: editStatus });
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'confirmed':
      case 'completed':
        return 'badge-success';
      case 'pending':
      case 'provider_assigned':
        return 'badge-warning';
      case 'cancelled':
      case 'no_show':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Bookings</h1>
      <p className="page-sub">
        Manage all bookings across the platform. View details and update status.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading bookings…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.bookings && data.bookings.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Service</th>
                <th>Category</th>
                <th>Date & Time</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Payment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.bookings.map(booking => (
                <tr key={booking.id}>
                  <td>
                    <strong>{booking.userName}</strong>
                    <div className="muted">{booking.userPhone}</div>
                  </td>
                  <td>
                    <strong>{booking.detail.serviceTitle}</strong>
                    <div className="muted">
                      {booking.detail.providerName || 'No provider'}
                    </div>
                  </td>
                  <td>
                    <span className="badge">{booking.category}</span>
                  </td>
                  <td>
                    {formatDate(booking.startsAt)}
                    <div className="muted">{booking.serviceMode}</div>
                  </td>
                  <td>
                    {booking.amount ? `₹${booking.amount}` : '—'}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    <span className="badge">{booking.paymentStatus}</span>
                  </td>
                  <td>
                    {hasPermission('catalog.write') ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => handleEdit(booking)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.bookings && data.bookings.length === 0 ? (
          <p className="muted">No bookings found.</p>
        ) : null}
      </div>

      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Booking Status</h2>
            <div className="form-group">
              <label>Booking ID</label>
              <p className="muted">{selectedBooking.id}</p>
            </div>
            <div className="form-group">
              <label>Service</label>
              <p>{selectedBooking.detail.serviceTitle}</p>
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="form-input"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="provider_assigned">Provider Assigned</option>
                <option value="on_the_way">On the Way</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setSelectedBooking(null)}
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
            {updateMutation.isError && (
              <p className="error">{(updateMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
        }
        .modal-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          justify-content: flex-end;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-input {
          width: 100%;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
        }
        .badge-success {
          background: #d4edda;
          color: #155724;
        }
        .badge-warning {
          background: #fff3cd;
          color: #856404;
        }
        .badge-error {
          background: #f8d7da;
          color: #721c24;
        }
        .small {
          padding: 0.25rem 0.5rem;
          font-size: 0.875rem;
        }
      `}</style>
    </AdminShell>
  );
}
