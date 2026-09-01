"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServiceCategory } from "@anticlock/contracts";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";

const trees = [
  "health",
  "fitness",
  "sports",
  "wellness",
  "tours_events",
  "beauty_spa",
  "course_training",
  "home_services",
  "ecommerce",
];

const blankCategory: ServiceCategory = {
  id: "",
  treeId: "health",
  name: "",
  sortOrder: 0,
  status: "published",
};

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] =
    useState<ServiceCategory>(blankCategory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () =>
      apiFetch<{ data: ServiceCategory[] }>("/admin/catalog/categories"),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
  const save = useMutation({
    mutationFn: (category: ServiceCategory) =>
      apiFetch(`/admin/catalog/categories/${category.id}`, {
        method: "PUT",
        body: JSON.stringify(category),
      }),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: (category: ServiceCategory) =>
      apiFetch("/admin/catalog/categories", {
        method: "POST",
        body: JSON.stringify(category),
      }),
    onSuccess: () => {
      setNewCategory(blankCategory);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/catalog/categories/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const updateField = <K extends keyof ServiceCategory>(
    category: ServiceCategory,
    field: K,
    value: ServiceCategory[K]
  ) => save.mutate({ ...category, [field]: value });

  return (
    <AdminShell>
      <h1 className="page-title">Categories</h1>
      <p className="page-sub">
        Manage active categories and their display order. Only Health may use a
        parent category for specialties.
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="section-title">Add category</h2>
        <div className="form-grid">
          <label>
            <span>ID</span>
            <input
              value={newCategory.id}
              onChange={(e) =>
                setNewCategory({ ...newCategory, id: e.target.value })
              }
            />
          </label>
          <label>
            <span>Name</span>
            <input
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory({ ...newCategory, name: e.target.value })
              }
            />
          </label>
          <label>
            <span>Section</span>
            <select
              value={newCategory.treeId}
              onChange={(e) =>
                setNewCategory({
                  ...newCategory,
                  treeId: e.target.value,
                  parentId:
                    e.target.value === "health"
                      ? newCategory.parentId
                      : undefined,
                })
              }
            >
              {trees.map((tree) => (
                <option key={tree}>{tree}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Health parent / specialty</span>
            <input
              disabled={newCategory.treeId !== "health"}
              value={newCategory.parentId ?? ""}
              placeholder="Optional parent ID"
              onChange={(e) =>
                setNewCategory({
                  ...newCategory,
                  parentId: e.target.value || undefined,
                })
              }
            />
          </label>
          <label>
            <span>Order</span>
            <input
              type="number"
              value={newCategory.sortOrder}
              onChange={(e) =>
                setNewCategory({
                  ...newCategory,
                  sortOrder: Number(e.target.value),
                })
              }
            />
          </label>
          <button
            className="btn primary"
            disabled={!newCategory.id || !newCategory.name || create.isPending}
            onClick={() => create.mutate(newCategory)}
          >
            Add category
          </button>
        </div>
        {create.error ? (
          <p className="error">{(create.error as Error).message}</p>
        ) : null}
      </div>

      <div className="card">
        {isLoading ? <p className="muted">Loading…</p> : null}
        {error ? <p className="error">{(error as Error).message}</p> : null}
        {data ? (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tree / Parent</th>
                <th>Order</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((category) => (
                <tr key={category.id}>
                  <td>
                    <input
                      value={category.name}
                      onChange={(e) =>
                        updateField(category, "name", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <div>{category.treeId}</div>
                    <small>
                      {category.parentId
                        ? `Specialty of ${category.parentId}`
                        : "Top level"}
                    </small>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={category.sortOrder}
                      onChange={(e) =>
                        updateField(
                          category,
                          "sortOrder",
                          Number(e.target.value)
                        )
                      }
                    />
                  </td>
                  <td>
                    <button
                      className="btn secondary"
                      onClick={() =>
                        updateField(
                          category,
                          "status",
                          category.status === "published"
                            ? "draft"
                            : "published"
                        )
                      }
                    >
                      {category.status === "published" ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn danger"
                      onClick={() => {
                        if (window.confirm(`Delete ${category.name}?`))
                          remove.mutate(category.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </AdminShell>
  );
}
