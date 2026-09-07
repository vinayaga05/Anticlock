'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InterestOption } from '@anticlock/contracts';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';

const blankInterest: InterestOption = {
  id: '',
  name: '',
  imageUrl: '',
  sortOrder: 0,
  isActive: true,
};

function cleaned(option: InterestOption) {
  return {
    ...option,
    id: option.id.trim().toLowerCase(),
    name: option.name.trim(),
    imageUrl: option.imageUrl?.trim() || undefined,
  };
}

export default function InterestsPage() {
  const queryClient = useQueryClient();
  const [newInterest, setNewInterest] = useState(blankInterest);
  const [drafts, setDrafts] = useState<Record<string, InterestOption>>({});
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'interests'],
    queryFn: () => apiFetch<{ data: InterestOption[] }>('/admin/interests'),
  });

  useEffect(() => {
    if (!data) return;
    setDrafts(Object.fromEntries(data.data.map(option => [option.id, option])));
  }, [data]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'interests'] });
  const create = useMutation({
    mutationFn: (option: InterestOption) =>
      apiFetch('/admin/interests', {
        method: 'POST',
        body: JSON.stringify(cleaned(option)),
      }),
    onSuccess: () => {
      setNewInterest(blankInterest);
      refresh();
    },
  });
  const save = useMutation({
    mutationFn: (option: InterestOption) =>
      apiFetch(`/admin/interests/${option.id}`, {
        method: 'PUT',
        body: JSON.stringify(cleaned(option)),
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/interests/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const patchDraft = (id: string, patch: Partial<InterestOption>) => {
    setDrafts(current => ({
      ...current,
      [id]: { ...(current[id] ?? blankInterest), ...patch },
    }));
  };

  return (
    <AdminShell>
      <h1 className="page-title">Mobile interests</h1>
      <p className="page-sub">
        These cards appear after a member’s first mobile sign-in and can later be
        updated from their profile settings. Members must choose at least three.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Add interest</h2>
        <div className="form-grid">
          <label>
            <span>ID</span>
            <input
              value={newInterest.id}
              placeholder="e.g. photography"
              onChange={event =>
                setNewInterest(current => ({ ...current, id: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Display name</span>
            <input
              value={newInterest.name}
              placeholder="Photography"
              onChange={event =>
                setNewInterest(current => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Image URL</span>
            <input
              value={newInterest.imageUrl ?? ''}
              placeholder="https://…"
              onChange={event =>
                setNewInterest(current => ({ ...current, imageUrl: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Display order</span>
            <input
              type="number"
              value={newInterest.sortOrder}
              onChange={event =>
                setNewInterest(current => ({
                  ...current,
                  sortOrder: Number(event.target.value) || 0,
                }))
              }
            />
          </label>
          <button
            className="btn primary"
            disabled={!newInterest.id || !newInterest.name || create.isPending}
            onClick={() => create.mutate(newInterest)}>
            Add interest
          </button>
        </div>
        {create.error ? <p className="error">{(create.error as Error).message}</p> : null}
      </div>

      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Preview</th>
                <th>Name / ID</th>
                <th>Image URL</th>
                <th>Order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map(option => {
                const draft = drafts[option.id] ?? option;
                return (
                  <tr key={option.id}>
                    <td>
                      {draft.imageUrl ? (
                        <img
                          src={draft.imageUrl}
                          alt=""
                          style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover' }}
                        />
                      ) : (
                        <span className="badge">No image</span>
                      )}
                    </td>
                    <td>
                      <input
                        value={draft.name}
                        onChange={event => patchDraft(option.id, { name: event.target.value })}
                      />
                      <small className="muted">{option.id}</small>
                    </td>
                    <td>
                      <input
                        value={draft.imageUrl ?? ''}
                        placeholder="https://…"
                        onChange={event => patchDraft(option.id, { imageUrl: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={draft.sortOrder}
                        onChange={event =>
                          patchDraft(option.id, { sortOrder: Number(event.target.value) || 0 })
                        }
                      />
                    </td>
                    <td>
                      <button
                        className="btn secondary"
                        onClick={() => patchDraft(option.id, { isActive: !draft.isActive })}>
                        {draft.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={() => save.mutate(draft)}>
                          Save
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => {
                            if (window.confirm(`Delete ${option.name}?`)) remove.mutate(option.id);
                          }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        {save.error || remove.error ? (
          <p className="error">{((save.error ?? remove.error) as Error).message}</p>
        ) : null}
      </div>
    </AdminShell>
  );
}
