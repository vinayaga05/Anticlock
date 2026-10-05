'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TripWithImages } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function TripsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedTrip, setSelectedTrip] = useState<TripWithImages | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'trips', 'trips'],
    queryFn: () => apiFetch<{ trips: TripWithImages[] }>('/admin/trips/trips'),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      apiFetch(`/admin/trips/trips/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'trips', 'trips'] });
      setSelectedTrip(null);
      setEditStatus('');
    },
  });

  function handleEdit(trip: TripWithImages) {
    setSelectedTrip(trip);
    setEditStatus(trip.status);
  }

  function handleUpdate() {
    if (selectedTrip && editStatus) {
      updateMutation.mutate({ id: selectedTrip.id, status: editStatus });
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
      case 'easy':
        return 'badge-success';
      case 'moderate':
        return 'badge-warning';
      case 'challenging':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Trips</h1>
      <p className="page-sub">
        Manage trip catalog. View and update trip details, itineraries, and availability.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading trips…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.trips && data.trips.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Trip</th>
                <th>Destination</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Group Size</th>
                <th>Difficulty</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.trips.map(trip => (
                <tr key={trip.id}>
                  <td>
                    {trip.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="trip-image"
                        src={trip.images[0].url}
                        alt={trip.name}
                      />
                    ) : (
                      <div className="trip-image-placeholder">No image</div>
                    )}
                  </td>
                  <td>
                    <strong>{trip.name}</strong>
                    <div className="muted">{trip.slug}</div>
                  </td>
                  <td>{trip.destination}</td>
                  <td>{trip.durationDays} days</td>
                  <td>
                    <strong>{formatPrice(trip.basePrice)}</strong>
                  </td>
                  <td>{trip.maxGroupSize} pax</td>
                  <td>
                    <span
                      className={`badge ${getDifficultyBadgeClass(trip.difficulty)}`}
                    >
                      {trip.difficulty}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(trip.status)}`}>
                      {trip.status}
                    </span>
                  </td>
                  <td>
                    {hasPermission('catalog.write') ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => handleEdit(trip)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.trips && data.trips.length === 0 ? (
          <p className="muted">No trips found.</p>
        ) : null}
      </div>

      {selectedTrip && (
        <div className="modal-overlay" onClick={() => setSelectedTrip(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Trip</h2>
            <div className="form-group">
              <label>Trip Name</label>
              <p>{selectedTrip.name}</p>
            </div>
            <div className="form-group">
              <label>Destination</label>
              <p>{selectedTrip.destination}</p>
            </div>
            <div className="form-group">
              <label>Duration</label>
              <p>{selectedTrip.durationDays} days</p>
            </div>
            <div className="form-group">
              <label>Base Price</label>
              <p>{formatPrice(selectedTrip.basePrice)} per person</p>
            </div>
            <div className="form-group">
              <label>Itinerary</label>
              <ul className="itinerary-list">
                {selectedTrip.itinerary.map((day, idx) => (
                  <li key={idx}>
                    <strong>Day {day.day}: {day.title}</strong>
                    <div className="muted">{day.description}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="form-input"
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
                onClick={() => setSelectedTrip(null)}
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
        .trip-image {
          width: 80px;
          height: 60px;
          object-fit: cover;
          border-radius: 4px;
        }
        .trip-image-placeholder {
          width: 80px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #999;
        }
        .itinerary-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .itinerary-list li {
          padding: 0.5rem 0;
          border-bottom: 1px solid #eee;
        }
        .itinerary-list li:last-child {
          border-bottom: none;
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
          max-width: 700px;
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
