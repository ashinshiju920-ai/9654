"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Edit2, FolderTree, Plus, RefreshCw, Trash2 } from "lucide-react";

type AdvancedCollection = {
  id: string;
  courseName: string;
  courseSlug: string;
  title: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  isPublished: boolean;
  questionCount: number;
  activeQuestionCount: number;
};

const courseOptions = [
  { slug: "ielts", name: "IELTS" },
  { slug: "oet", name: "OET" },
  { slug: "pte", name: "PTE" },
  { slug: "german", name: "German" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AdvancedCollectionsClient() {
  const [collections, setCollections] = useState<AdvancedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdvancedCollection | null>(null);
  const [form, setForm] = useState({
    courseSlug: "ielts",
    title: "",
    slug: "",
    description: "",
    displayOrder: 0,
    isPublished: false,
  });

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/advanced/collections");
      const data = (await res.json()) as { collections?: AdvancedCollection[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load collections.");
      setCollections(data.collections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load collections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCollections);
  }, [loadCollections]);

  const resetForm = () => {
    setEditing(null);
    setForm({
      courseSlug: "ielts",
      title: "",
      slug: "",
      description: "",
      displayOrder: 0,
      isPublished: false,
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const payload = {
      courseSlugOrId: form.courseSlug,
      title: form.title.trim(),
      slug: slugify(form.slug || form.title),
      description: form.description.trim(),
      displayOrder: Number(form.displayOrder) || 0,
      isPublished: form.isPublished,
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/advanced/collections/${editing.id}` : "/api/admin/advanced/collections",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save collection.");
      setMessage(editing ? "Collection updated." : "Collection created.");
      resetForm();
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save collection.");
    }
  };

  const remove = async (collection: AdvancedCollection) => {
    if (!confirm(`Remove "${collection.title}"? Collections with attempts will be protected.`)) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/advanced/collections/${collection.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to remove collection.");
      setMessage("Collection removed.");
      await loadCollections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove collection.");
    }
  };

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      {message && (
        <div className="admin-alert admin-alert-success">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}
      {error && <div className="admin-alert admin-alert-error">{error}</div>}

      <form className="admin-card" onSubmit={submit}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
          {editing ? "Edit Advanced Collection" : "Create Advanced Collection"}
        </h2>
        <div className="admin-form-row">
          <div className="admin-form-group" style={{ flex: 1 }}>
            <label className="admin-label">Course</label>
            <select
              className="admin-select"
              disabled={Boolean(editing)}
              value={form.courseSlug}
              onChange={(event) => setForm((prev) => ({ ...prev, courseSlug: event.target.value }))}
            >
              {courseOptions.map((course) => (
                <option key={course.slug} value={course.slug}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-group" style={{ flex: 2 }}>
            <label className="admin-label">Title</label>
            <input
              className="admin-input"
              required
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                  slug: prev.slug ? prev.slug : slugify(event.target.value),
                }))
              }
            />
          </div>
          <div className="admin-form-group" style={{ flex: 1 }}>
            <label className="admin-label">Slug</label>
            <input
              className="admin-input"
              required
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))}
            />
          </div>
        </div>
        <div className="admin-form-row">
          <div className="admin-form-group" style={{ flex: 2 }}>
            <label className="admin-label">Description</label>
            <input
              className="admin-input"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="admin-form-group">
            <label className="admin-label">Display Order</label>
            <input
              className="admin-input"
              type="number"
              value={form.displayOrder}
              onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value) }))}
            />
          </div>
          <label className="admin-form-group" style={{ justifyContent: "end" }}>
            <span className="admin-label">Published</span>
            <input
              checked={form.isPublished}
              type="checkbox"
              onChange={(event) => setForm((prev) => ({ ...prev, isPublished: event.target.checked }))}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          {editing && (
            <button className="admin-btn admin-btn-secondary" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
          <button className="admin-btn admin-btn-primary" type="submit">
            <Plus size={16} />
            {editing ? "Save Collection" : "Create Collection"}
          </button>
        </div>
      </form>

      <div className="admin-card">
        <div className="admin-actions-bar">
          <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Advanced Collections</h2>
          <button className="admin-btn admin-btn-secondary" onClick={loadCollections} type="button">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="admin-loading-state">Loading collections...</div>
        ) : collections.length === 0 ? (
          <div className="admin-empty-state">
            <FolderTree size={36} />
            <p>No Advanced collections yet.</p>
          </div>
        ) : (
          <div className="admin-table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Collection</th>
                  <th>Questions</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((collection) => (
                  <tr key={collection.id}>
                    <td>
                      <span className="admin-badge admin-badge-neutral">
                        {collection.courseSlug.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong>{collection.title}</strong>
                      <div style={{ color: "var(--slate-500)", fontSize: "0.75rem" }}>
                        {collection.slug}
                      </div>
                    </td>
                    <td>
                      {collection.activeQuestionCount} active / {collection.questionCount} total
                    </td>
                    <td>
                      <span className={`admin-badge ${collection.isPublished ? "admin-badge-success" : "admin-badge-archived"}`}>
                        {collection.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>{collection.displayOrder}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="admin-row-actions">
                        <button
                          className="admin-icon-btn"
                          type="button"
                          onClick={() => {
                            setEditing(collection);
                            setForm({
                              courseSlug: collection.courseSlug,
                              title: collection.title,
                              slug: collection.slug,
                              description: collection.description || "",
                              displayOrder: collection.displayOrder,
                              isPublished: collection.isPublished,
                            });
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="admin-icon-btn admin-icon-btn-danger"
                          type="button"
                          onClick={() => remove(collection)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
