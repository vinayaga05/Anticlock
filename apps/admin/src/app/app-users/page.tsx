"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/AdminShell";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type AppUser = {
  id: string;
  displayName: string;
  phone: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  isActive: boolean;
  isPrivate: boolean;
  allowMessages: boolean;
  allowFollowRequests: boolean;
  showFollowerLists: boolean;
  createdAt: string;
  updatedAt: string;
  interestsCompletedAt: string | null;
};
type Result = {
  data: AppUser[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";
const yesNo = (value: boolean) => (value ? "Yes" : "No");
export default function AppUsersPage() {
  const { hasPermission } = useAuth();
  const permitted = hasPermission("users.read");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const detailsRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) detailsRef.current?.showModal();
  }, [selected]);
  const query = useQuery({
    queryKey: ["admin", "app-users", q, status, page, limit],
    enabled: permitted,
    queryFn: () =>
      apiFetch<Result>(
        `/admin/app-users?${new URLSearchParams({
          q,
          status,
          page: String(page),
          limit: String(limit),
        })}`
      ),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQ(search.trim());
    setPage(1);
  };
  return (
    <AdminShell>
      <h1 className="page-title">App users</h1>
      <p className="page-sub">
        Registered mobile app accounts and their profile details. Phone numbers
        are the sign-in identifiers.
      </p>
      {!permitted ? (
        <p role="alert">You do not have permission to view app users.</p>
      ) : (
        <>
          <form
            onSubmit={submit}
            className="toolbar"
            style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <label className="field">
              Search
              <input
                className="form-input"
                value={search}
                maxLength={100}
                placeholder="Name, phone or user ID"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="field">
              Account status
              <select
                className="form-input"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All accounts</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              Users per page
              <select
                className="form-input"
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit">
              Search
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setQ("");
                setStatus("all");
                setPage(1);
              }}
            >
              Clear
            </button>
            <button
              className="btn secondary"
              type="button"
              disabled={query.isFetching}
              onClick={() => {
                setSelected(null);
                void query.refetch();
              }}
            >
              Refresh
            </button>
          </form>
          {query.isLoading ? <p role="status">Loading app users…</p> : null}
          {query.error ? (
            <div role="alert" className="error">
              {(query.error as Error).message}
              <button
                className="btn secondary"
                onClick={() => void query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : null}
          {query.data ? (
            <section className="card">
              <p role="status">{query.data.meta.total} matching users</p>
              {query.data.data.length ? (
                <div style={{ overflowX: "auto" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Phone</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.data.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              {user.avatarUrl ? (
                                <img
                                  src={user.avatarUrl}
                                  alt=""
                                  width={40}
                                  height={40}
                                  style={{
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                  }}
                                />
                              ) : null}
                              <span>
                                <strong>
                                  {user.displayName || "Unnamed user"}
                                </strong>
                                <small
                                  className="muted"
                                  style={{ display: "block" }}
                                >
                                  {user.id}
                                </small>
                              </span>
                            </div>
                          </td>
                          <td>{user.phone}</td>
                          <td>{user.location || "—"}</td>
                          <td>{user.isActive ? "Active" : "Inactive"}</td>
                          <td>{date(user.createdAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn secondary small"
                              onClick={() => setSelected(user)}
                              aria-label={`View details for ${
                                user.displayName || "Unnamed user"
                              }`}
                            >
                              View details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No app users match these filters.</p>
              )}
              <div
                className="toolbar"
                style={{ display: "flex", gap: 12, alignItems: "center" }}
              >
                <button
                  className="btn secondary"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.max(1, query.data.meta.totalPages)}
                </span>
                <button
                  className="btn secondary"
                  disabled={
                    page >= query.data.meta.totalPages || query.isFetching
                  }
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            </section>
          ) : null}
        </>
      )}
      {selected ? (
        <dialog
          ref={detailsRef}
          className="modal-card"
          style={{
            border: 0,
            maxHeight: "calc(100vh - 40px)",
            overflowY: "auto",
          }}
          onCancel={(event) => {
            event.preventDefault();
            setSelected(null);
          }}
          aria-modal="true"
          aria-labelledby="app-user-details-title"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSelected(null);
          }}
        >
          <h2 id="app-user-details-title">
            {selected.displayName || "User"} — details
          </h2>
          <dl>
            {Object.entries({
              "User ID": selected.id,
              "Display name": selected.displayName,
              Phone: selected.phone,
              Status: selected.isActive ? "Active" : "Inactive",
              Bio: selected.bio,
              Location: selected.location,
              Website: selected.website,
              "Profile visibility": selected.isPrivate ? "Private" : "Public",
              "Messages allowed": yesNo(selected.allowMessages),
              "Follow requests allowed": yesNo(selected.allowFollowRequests),
              "Follower lists visible": yesNo(selected.showFollowerLists),
              "Interests completed": date(selected.interestsCompletedAt),
              Registered: date(selected.createdAt),
              "Profile updated": date(selected.updatedAt),
            }).map(([label, value]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <dt>
                  <strong>{label}</strong>
                </dt>
                <dd
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            autoFocus
            className="btn secondary"
            onClick={() => setSelected(null)}
          >
            Close details
          </button>
        </dialog>
      ) : null}
    </AdminShell>
  );
}
