'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TripBookingAdminListItem } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function TripBookingsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedBooking, setSelectedBooking] =
    useState<TripBookingAdminListItem | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'trips', 'bookings'],
    queryFn: () =>
      apiFetch<{ bookings: TripBookingAdminListItem[] }>(
        '/admin/trips/trip-bookings',
      ),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: string; paymentStatus: string }) =>
      apiFetch(`/admin/trips/trip-bookings/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: input.status,
          paymentStatus: input.paymentStatus,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'trips', 'bookings'] });
      setSelectedBooking(null);
      setEditStatus('');
      setEditPaymentStatus('');
    },
  });

  function handleEdit(booking: TripBookingAdminListItem) {
    setSelectedBooking(booking);
    setEditStatus(booking.status);
    setEditPaymentStatus(booking.paymentStatus);
  }

  function handleUpdate() {
    if (selectedBooking && editStatus && editPaymentStatus) {
      updateMutation.mutate({
        id: selectedBooking.id,
        status: editStatus,
        paymentStatus: editPaymentStatus,
      });
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatPrice(price: number) {
    return `₹${(price / 100).toFixed(2)}`;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'confirmed':
        return 'badge-info';
      case 'pending':
        return 'badge-warning';
      case 'cancelled':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Trip Bookings</h1>
      <p className="page-sub">
        Manage all trip bookings. View booking details and update status for
        operations.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading bookings…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.bookings && data.bookings.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Customer</th>
                <th>Trip</th>
                <th>Start Date</th>
                <th>Travelers</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Booked</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.bookings.map(booking => (
                <tr key={booking.id}>
                  <td>
                    <strong>{booking.bookingNumber}</strong>
                  </td>
                  <td>
                    <strong>{booking.userName}</strong>
                    <div className="muted">{booking.userPhone}</div>
                  </td>
                  <td>
                    <strong>{booking.tripName}</strong>
                  </td>
                  <td>
                    <div className="muted">{formatDate(booking.startDate)}</div>
                  </td>
                  <td>{booking.numberOfTravelers} pax</td>
                  <td>
                    <strong>{formatPrice(booking.totalPrice)}</strong>
                  </td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(booking.status)}`}
                    >
                      {booking.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(booking.paymentStatus)}`}
                    >
                      {booking.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <div className="muted">{formatDate(booking.createdAt)}</div>
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
              <label>Booking Number</label>
              <p>{selectedBooking.bookingNumber}</p>
            </div>
            <div className="form-group">
              <label>Customer</label>
              <p>
                {selectedBooking.userName} ({selectedBooking.userPhone})
              </p>
            </div>
            <div className="form-group">
              <label>Trip</label>
              <p>{selectedBooking.tripName}</p>
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <p>{formatDate(selectedBooking.startDate)}</p>
            </div>
            <div className="form-group">
              <label>Travelers</label>
              <ul className="travelers-list">
                {selectedBooking.travelerDetails.map((traveler, idx) => (
                  <li key={idx}>
                    {traveler.name} (Age: {traveler.age})
                    {traveler.email && (
                      <div className="muted">{traveler.email}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            {selectedBooking.specialRequests && (
              <div className="form-group">
                <label>Special Requests</label>
                <p>{selectedBooking.specialRequests}</p>
              </div>
            )}
            <div className="form-group">
              <label>Total Price</label>
              <p>{formatPrice(selectedBooking.totalPrice)}</p>
            </div>
            <div className="form-group">
              <label htmlFor="status">Booking Status</label>
              <select
                id="status"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="form-input"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="paymentStatus">Payment Status</label>
              <select
                id="paymentStatus"
                value={editPaymentStatus}
                onChange={e => setEditPaymentStatus(e.target.value)}
                className="form-input"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
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
        .travelers-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .travelers-list li {
          padding: 0.25rem 0;
          font-size: 0.9rem;
        }
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
          max-width: 600px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
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
        .badge-info {
          background: #d1ecf1;
          color: #0c5460;
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
