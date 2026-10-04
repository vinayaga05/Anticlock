'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OrderAdminListItem } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function OrdersPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<OrderAdminListItem | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'shop', 'orders'],
    queryFn: () =>
      apiFetch<{ orders: OrderAdminListItem[] }>('/admin/shop/orders'),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: string; paymentStatus: string }) =>
      apiFetch(`/admin/shop/orders/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: input.status,
          paymentStatus: input.paymentStatus,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'orders'] });
      setSelectedOrder(null);
      setEditStatus('');
      setEditPaymentStatus('');
    },
  });

  function handleEdit(order: OrderAdminListItem) {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditPaymentStatus(order.paymentStatus);
  }

  function handleUpdate() {
    if (selectedOrder && editStatus && editPaymentStatus) {
      updateMutation.mutate({
        id: selectedOrder.id,
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
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function formatPrice(price: number) {
    return `₹${(price / 100).toFixed(2)}`;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'delivered':
        return 'badge-success';
      case 'pending':
      case 'confirmed':
        return 'badge-warning';
      case 'cancelled':
      case 'refunded':
        return 'badge-error';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Orders</h1>
      <p className="page-sub">
        Manage all orders. View order details and update status for fulfillment.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading orders…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.orders && data.orders.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.orders.map(order => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber}</strong>
                  </td>
                  <td>
                    <strong>{order.userName}</strong>
                    <div className="muted">{order.userPhone}</div>
                  </td>
                  <td>
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </td>
                  <td>
                    <strong>{formatPrice(order.total)}</strong>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(order.paymentStatus)}`}
                    >
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td>
                    <div className="muted">{formatDate(order.createdAt)}</div>
                  </td>
                  <td>
                    {hasPermission('catalog.write') ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => handleEdit(order)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.orders && data.orders.length === 0 ? (
          <p className="muted">No orders found.</p>
        ) : null}
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Order Status</h2>
            <div className="form-group">
              <label>Order Number</label>
              <p>{selectedOrder.orderNumber}</p>
            </div>
            <div className="form-group">
              <label>Customer</label>
              <p>
                {selectedOrder.userName} ({selectedOrder.userPhone})
              </p>
            </div>
            <div className="form-group">
              <label>Items</label>
              <ul className="items-list">
                {selectedOrder.items.map((item, idx) => (
                  <li key={idx}>
                    {item.productName} × {item.quantity} - {formatPrice(item.totalPrice)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="form-group">
              <label htmlFor="status">Order Status</label>
              <select
                id="status"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value)}
                className="form-input"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
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
                onClick={() => setSelectedOrder(null)}
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
        .items-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .items-list li {
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
