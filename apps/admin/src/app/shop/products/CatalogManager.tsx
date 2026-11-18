"use client";
import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Product,
  ProductCategory,
  MediaAsset,
  CreateProductRequest,
} from "@anticlock/contracts";
import { apiFetch } from "@/lib/api";
import { MediaPicker } from "@/components/media/MediaPicker";

const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export function CatalogManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ["admin", "shop", "categories"],
    queryFn: () =>
      apiFetch<{ categories: ProductCategory[] }>("/admin/shop/categories"),
  });
  const products = useQuery({
    queryKey: ["admin", "shop", "catalog"],
    queryFn: () =>
      apiFetch<{ products: Product[] }>(
        "/admin/shop/products?catalogOnly=true&limit=100"
      ),
  });
  const [name, setName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [inventory, setInventory] = useState("0");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [images, setImages] = useState<MediaAsset[]>([]);
  const [picker, setPicker] = useState(false);
  const [notice, setNotice] = useState("");
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin", "shop"] });
  };
  const categorySave = useMutation({
    mutationFn: () =>
      apiFetch("/admin/shop/categories", {
        method: "POST",
        body: JSON.stringify({
          name: categoryName.trim(),
          slug: slug(categoryName),
          status: "published",
        }),
      }),
    onSuccess: () => {
      setCategoryName("");
      setNotice(
        "Category published. It is available in the app after refresh."
      );
      invalidate();
    },
  });
  const productSave = useMutation({
    mutationFn: () => {
      const body: CreateProductRequest = {
        name: name.trim(),
        slug: `${slug(name) || "product"}-${crypto.randomUUID().slice(0, 8)}`,
        categoryId,
        description: description.trim(),
        price: Math.round(Number(price) * 100),
        inventory: Number(inventory),
        status,
        imageIds: images.map((image) => image.id),
      };
      return apiFetch("/admin/shop/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      setName("");
      setDescription("");
      setPrice("");
      setInventory("0");
      setImages([]);
      setNotice(
        status === "published"
          ? "Product published. It is available in Shop after refresh."
          : "Draft saved. Publish it below when ready."
      );
      invalidate();
    },
  });
  const update = useMutation({
    mutationFn: ({ path, status: next }: { path: string; status: string }) =>
      apiFetch(path, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      }),
    onSuccess: invalidate,
  });
  const error =
    categories.error ||
    products.error ||
    categorySave.error ||
    productSave.error ||
    update.error;
  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    setNotice("");
    productSave.mutate();
  };
  return (
    <>
      <h2>Shop catalog</h2>
      <p className="muted">
        Manage Shop categories and operator products. Service categories are
        managed separately in Catalog.
      </p>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {(error as Error).message}
        </p>
      ) : null}
      <section className="card">
        <h3>Categories</h3>
        {canWrite ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              categorySave.mutate();
            }}
            className="toolbar"
          >
            <label>
              Category name
              <input
                className="form-input"
                required
                maxLength={120}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
              />
            </label>
            <button
              className="btn"
              disabled={categorySave.isPending || !slug(categoryName)}
            >
              Add category
            </button>
          </form>
        ) : null}
        {categories.isLoading ? <p>Loading categories…</p> : null}
        {!categories.isLoading && !categories.data?.categories.length ? (
          <p>No Shop categories. Add and publish one before adding products.</p>
        ) : null}
        <ul>
          {categories.data?.categories.map((category) => (
            <li key={category.id}>
              {category.name} — {category.status}{" "}
              {canWrite ? (
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      path: `/admin/shop/categories/${category.id}`,
                      status:
                        category.status === "published" ? "draft" : "published",
                    })
                  }
                >
                  {category.status === "published" ? "Unpublish" : "Publish"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {canWrite ? (
        <section className="card">
          <h3>Add product</h3>
          <form onSubmit={submitProduct}>
            <fieldset
              disabled={productSave.isPending}
              style={{ border: 0, padding: 0, margin: 0 }}
            >
              <label>
                Product name
                <input
                  className="form-input"
                  required
                  maxLength={200}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  className="form-input"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <label>
                Category
                <select
                  className="form-input"
                  required
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Choose a published category</option>
                  {categories.data?.categories
                    .filter((c) => c.status === "published")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Price (₹)
                <input
                  className="form-input"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </label>
              <label>
                Stock quantity
                <input
                  className="form-input"
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={inventory}
                  onChange={(event) => setInventory(event.target.value)}
                />
              </label>
              <label>
                Status
                <select
                  className="form-input"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as typeof status)
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published in Shop</option>
                </select>
              </label>
              <div className="toolbar">
                {images.map((image) => (
                  <button
                    type="button"
                    className="btn secondary"
                    key={image.id}
                    onClick={() =>
                      setImages((value) =>
                        value.filter((i) => i.id !== image.id)
                      )
                    }
                  >
                    Remove {image.originalFilename ?? "image"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setPicker(true)}
              >
                Add product images
              </button>
              <p className="muted">
                Select images from Media Library; upload new images there first.
                The first image is the cover.
              </p>
              <button
                className="btn"
                disabled={
                  productSave.isPending ||
                  !categoryId ||
                  !name.trim() ||
                  (status === "published" && images.length === 0)
                }
              >
                {productSave.isPending
                  ? "Saving…"
                  : status === "published"
                  ? "Publish product"
                  : "Save draft"}
              </button>
            </fieldset>
          </form>
        </section>
      ) : null}
      <section className="card">
        <h3>Catalog products</h3>
        {products.isLoading ? <p>Loading products…</p> : null}
        {products.data?.products.length === 0 ? (
          <p>No catalog products yet.</p>
        ) : null}
        <ul>
          {products.data?.products.map((product) => (
            <li key={product.id}>
              {product.name} — ₹{(product.price / 100).toFixed(2)} —{" "}
              {product.status}{" "}
              {canWrite ? (
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={
                    update.isPending ||
                    (product.status !== "published" &&
                      product.images.length === 0)
                  }
                  onClick={() =>
                    update.mutate({
                      path: `/admin/shop/products/${product.id}`,
                      status:
                        product.status === "published" ? "draft" : "published",
                    })
                  }
                >
                  {product.status === "published" ? "Unpublish" : "Publish"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        kind="image"
        publicOnly
        multiple
        selectedIds={images.map((i) => i.id)}
        onSelect={(asset) =>
          setImages((value) =>
            value.some((i) => i.id === asset.id)
              ? value.filter((i) => i.id !== asset.id)
              : [...value, asset]
          )
        }
        onConfirm={() => setPicker(false)}
      />
    </>
  );
}
