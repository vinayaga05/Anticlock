'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_PERMISSIONS, type Role } from '@anticlock/contracts';
import { useState } from 'react';
import { AdminShell } from '@/components/AdminShell';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type UserRow = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  createdAt: string;
};

type RoleRow = { id: string; name: string; description: string | null };

export default function UsersPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Role[]>([]);

  const users = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiFetch<{ data: UserRow[] }>('/admin/users'),
  });

  const roles = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => apiFetch<{ data: RoleRow[] }>('/admin/roles'),
    enabled: hasPermission('roles.manage'),
  });

  const assign = useMutation({
    mutationFn: (input: { userId: string; roles: Role[] }) =>
      apiFetch(`/admin/users/${input.userId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: input.roles }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  function openEditor(user: UserRow) {
    setSelected(user.id);
    setDraftRoles(user.roles as Role[]);
  }

  return (
    <AdminShell>
      <h1 className="page-title">Users & roles</h1>
      <p className="page-sub">
        Assign roles to admin accounts. Permission matrix is read-only in v1.
      </p>
      <div className="grid-2">
        <div className="card">
          {users.isLoading ? <p className="muted">Loading…</p> : null}
          {users.error ? (
            <p className="error">{(users.error as Error).message}</p>
          ) : null}
          {users.data ? (
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Roles</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data.data.map(u => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.name}</strong>
                      <div className="muted">{u.email}</div>
                    </td>
                    <td>
                      {u.roles.map(r => (
                        <span key={r} className="badge">
                          {r}
                        </span>
                      ))}
                    </td>
                    <td>
                      {hasPermission('roles.manage') ? (
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => openEditor(u)}
                        >
                          Edit roles
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {selected && roles.data ? (
            <div style={{ marginTop: 16 }}>
              <h3>Assign roles</h3>
              {roles.data.data.map(role => {
                const checked = draftRoles.includes(role.id as Role);
                return (
                  <label
                    key={role.id}
                    style={{ display: 'flex', gap: 8, marginBottom: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => {
                        setDraftRoles(prev =>
                          e.target.checked
                            ? [...prev, role.id as Role]
                            : prev.filter(r => r !== role.id),
                        );
                      }}
                    />
                    {role.name}
                  </label>
                );
              })}
              <button
                type="button"
                className="btn"
                disabled={draftRoles.length === 0 || assign.isPending}
                onClick={() =>
                  assign.mutate({ userId: selected, roles: draftRoles })
                }
              >
                Save roles
              </button>
              {assign.isError ? (
                <p className="error">{(assign.error as Error).message}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="card">
          <h3>Permissions matrix</h3>
          <p className="muted">Read-only defaults from contracts.</p>
          {Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => (
            <div key={role} style={{ marginBottom: 14 }}>
              <strong>{role}</strong>
              <div>
                {perms.map(p => (
                  <span key={p} className="badge">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
