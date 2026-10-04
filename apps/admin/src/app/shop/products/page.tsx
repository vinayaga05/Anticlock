'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProductWithImages } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProductsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<ProductWithImages | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'shop', 'products'],
    queryFn: () =>
      apiFetch<{ products: ProductWithImages[] }>('/admin/shop/products'),
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

  function handleEdit(product: ProductWithImages) {
    setSelectedProduct(product);
    setEditStatus(product.status);
  }

  function handleUpdate() {
    if (selectedProduct && editStatus) {
      updateMutation.mutate({ id: selectedProduct.id, status: editStatus });
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

  return (
    <AdminShell>
      <h1 className="page-title">Products</h1>
      <p className="page-sub">
        Manage product catalog. View and update product details and status.
      </p>

      <div className="card">
        {isLoading ? <p className="muted">Loading products…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}

        {data?.products && data.products.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Image</th>
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
                    {product.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="product-image"
                        src={product.images[0].url}
                        alt={product.name}
                      />
                    ) : (
                      <div className="product-image-placeholder" />
                    )}
                  </td>
                  <td>
                    <strong>{product.name}</strong>
                    <div className="muted">{product.slug}</div>
                  </td>
                  <td>{product.categoryId || '—'}</td>
                  <td>
                    <strong>{formatPrice(product.price)}</strong>
                    {product.compareAtPrice && (
                      <div className="muted strikethrough">
                        {formatPrice(product.compareAtPrice)}
                      </div>
                    )}
                  </td>
                  <td>
                    {product.inventory !== null ? product.inventory : '∞'}
                  </td>
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
            {updateMutation.isError && (
              <p className="error">{(updateMutation.error as Error).message}</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .product-image {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 4px;
        }
        .product-image-placeholder {
          width: 60px;
          height: 60px;
          background: #f0f0f0;
          border-radius: 4px;
        }
        .strikethrough {
          text-decoration: line-through;
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
