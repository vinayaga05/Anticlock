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
    mutationFn: (input: {
      id: string;
      status?: string;
      paymentStatus?: string;
    }) =>
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
    if (selectedOrder && (editStatus || editPaymentStatus)) {
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

  function formatPrice(paise: number) {
    return `₹${(paise / 100).toFixed(2)}`;
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case 'delivered':
        return 'badge-success';
      case 'pending':
      case 'confirmed':
        return 'badge-warning';
      case 'cancelled':
        return 'badge-error';
      case 'processing':
      case 'shipped':
        return 'badge-info';
      default:
        return 'badge';
    }
  }

  return (
    <AdminShell>
      <h1 className="page-title">Orders</h1>
      <p className="page-sub">
        Manage all shop orders. View details and update status.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading orders…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.orders && data.orders.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
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
                    {order.items.map((item, idx) => (
                      <div key={idx}>
                        {item.productName} × {item.quantity}
                      </div>
                    ))}
                  </td>
                  <td>
                    <strong>{formatPrice(order.total)}</strong>
                    <div className="muted">
                      Sub: {formatPrice(order.subtotal)}
                      <br />
                      Ship: {formatPrice(order.shipping)}
                      <br />
                      Tax: {formatPrice(order.tax)}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${getStatusBadgeClass(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    <span className="badge">{order.paymentStatus}</span>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
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
            <h2>Edit Order</h2>
            <div className="form-group">
              <label>Order Number</label>
              <p className="muted">{selectedOrder.orderNumber}</p>
            </div>
            <div className="form-group">
              <label>Customer</label>
              <p>
                {selectedOrder.userName} ({selectedOrder.userPhone})
              </p>
            </div>
            <div className="form-group">
              <label>Items</label>
              {selectedOrder.items.map((item, idx) => (
                <p key={idx}>
                  {item.productName} × {item.quantity} = {formatPrice(item.price * item.quantity)}
                </p>
              ))}
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
                <option value="refunded">Refunded</option>
                <option value="failed">Failed</option>
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
          </div>
        </div>
      )}
    </AdminShell>
  );
}
