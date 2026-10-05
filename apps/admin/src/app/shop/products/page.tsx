'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Product } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editStatus, setEditStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'shop', 'products'],
    queryFn: () =>
      apiFetch<{ products: Product[] }>('/admin/shop/products'),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; status: string }) =>
      apiFetch(`/admin/shop/products/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'shop', 'products'] });
      setSelectedProduct(null);
      setEditStatus('');
    },
  });

  function handleEdit(product: Product) {
    setSelectedProduct(product);
    setEditStatus(product.status);
  }

  function handleUpdate() {
    if (selectedProduct && editStatus) {
      updateMutation.mutate({ id: selectedProduct.id, status: editStatus });
    }
  }

  function formatPrice(paise: number) {
    return `₹${(paise / 100).toFixed(2)}`;
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

  return (
    <AdminShell>
      <h1 className="page-title">Products</h1>
      <p className="page-sub">
        Manage all products in the shop. Update status and inventory.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading products…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.products && data.products.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Inventory</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.products.map(product => (
                <tr key={product.id}>
                  <td>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {product.images[0]?.url && (
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                        />
                      )}
                      <div>
                        <strong>{product.name}</strong>
                        <div className="muted">{product.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td>{product.categoryId}</td>
                  <td>
                    <strong>{formatPrice(product.price)}</strong>
                    {product.compareAtPrice && (
                      <div className="muted">
                        <s>{formatPrice(product.compareAtPrice)}</s>
                      </div>
                    )}
                  </td>
                  <td>{product.inventory} units</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(product.status)}`}>
                      {product.status}
                    </span>
                  </td>
                  <td>
                    {hasPermission('catalog.write') ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => handleEdit(product)}
                      >
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data?.products && data.products.length === 0 ? (
          <p className="muted">No products found.</p>
        ) : null}
      </div>

      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Edit Product Status</h2>
            <div className="form-group">
              <label>Product</label>
              <p>{selectedProduct.name}</p>
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
                onClick={() => setSelectedProduct(null)}
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
