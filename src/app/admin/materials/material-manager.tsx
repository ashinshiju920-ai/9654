"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { AdminMaterialItem } from "@/lib/admin/queries";

export function MaterialManager({
  initialMaterials = [],
}: {
  initialMaterials?: AdminMaterialItem[];
}) {
  const [materials, setMaterials] = useState<AdminMaterialItem[]>(initialMaterials);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminMaterialItem | null>(null);

  useEffect(() => {
    fetch("/api/admin/materials")
      .then((res) => res.json())
      .then((data: unknown) => {
        const d = data as { materials?: AdminMaterialItem[] };
        if (d?.materials) setMaterials(d.materials);
      })
      .catch(() => {});
  }, []);

  // Upload Form State
  const [uploadCourse, setUploadCourse] = useState("ielts");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPublished, setUploadPublished] = useState(true);
  const [uploadOrder, setUploadOrder] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Action status message
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const filteredMaterials =
    selectedCourse === "all"
      ? materials
      : materials.filter((m) => m.courseSlug === selectedCourse);

  function formatBytes(bytes: number | null): string {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a PDF file to upload.");
      return;
    }

    if (!uploadTitle.trim()) {
      setUploadError("Material title is required.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("courseSlug", uploadCourse);
    formData.append("title", uploadTitle.trim());
    if (uploadDesc.trim()) formData.append("description", uploadDesc.trim());
    formData.append("displayOrder", String(uploadOrder));
    formData.append("isPublished", uploadPublished ? "true" : "false");

    try {
      const res = await fetch("/api/admin/materials/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as { material: AdminMaterialItem; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setMaterials((prev) => [data.material, ...prev]);
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDesc("");
      setStatusMsg({
        type: "success",
        text: `Uploaded '${data.material.title}' successfully to private R2 storage.`,
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function togglePublish(mat: AdminMaterialItem) {
    setActionLoadingId(mat.id);
    setStatusMsg(null);
    const newPublished = !mat.isPublished;

    try {
      const res = await fetch(`/api/admin/materials/${mat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: newPublished }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to update publish status");

      setMaterials((prev) =>
        prev.map((m) => (m.id === mat.id ? { ...m, isPublished: newPublished } : m)),
      );
      setStatusMsg({
        type: "success",
        text: `'${mat.title}' is now ${newPublished ? "Published" : "Unpublished"}.`,
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Action failed",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setActionLoadingId(targetId);

    try {
      const res = await fetch(`/api/admin/materials/${targetId}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to delete");

      setMaterials((prev) => prev.filter((m) => m.id !== targetId));
      setStatusMsg({
        type: "success",
        text: `Deleted '${deleteTarget.title}' and removed file from R2.`,
      });
      setDeleteTarget(null);
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Deletion failed",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="admin-space">
      {statusMsg && (
        <div className={`admin-alert admin-alert--${statusMsg.type}`}>
          {statusMsg.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <Filter size={16} className="admin-toolbar__icon" />
          <select
            className="admin-select"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            aria-label="Filter by course"
          >
            <option value="all">All Courses ({materials.length})</option>
            <option value="ielts">IELTS</option>
            <option value="oet">OET</option>
            <option value="pte">PTE</option>
            <option value="german">German</option>
          </select>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn--primary"
          onClick={() => {
            setIsUploadOpen(true);
            setUploadError(null);
          }}
        >
          <Plus size={16} />
          <span>Upload Study PDF</span>
        </button>
      </div>

      {/* Materials Table */}
      <div className="admin-card">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title / Description</th>
                <th>Course</th>
                <th>File Size</th>
                <th>Status</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-table__empty">
                    <FileText size={32} />
                    <p>No study materials found for this course.</p>
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((mat) => (
                  <tr key={mat.id} className={!mat.isPublished ? "is-dimmed" : undefined}>
                    <td>
                      <strong>{mat.title}</strong>
                      {mat.description && (
                        <p className="admin-table__subtext">{mat.description}</p>
                      )}
                      <code className="admin-code admin-code--sm">{mat.r2ObjectKey}</code>
                    </td>
                    <td>
                      <span className={`admin-course-badge is-${mat.courseSlug}`}>
                        {mat.courseName || mat.courseSlug.toUpperCase()}
                      </span>
                    </td>
                    <td>{formatBytes(mat.fileSizeBytes)}</td>
                    <td>
                      <button
                        type="button"
                        className={`admin-status-toggle ${mat.isPublished ? "is-active" : "is-inactive"}`}
                        onClick={() => togglePublish(mat)}
                        disabled={actionLoadingId === mat.id}
                        title={`Click to ${mat.isPublished ? "unpublish" : "publish"}`}
                      >
                        {mat.isPublished ? "Published" : "Draft / Private"}
                      </button>
                    </td>
                    <td>{new Date(mat.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="admin-table-actions">
                        <a
                          href={`/api/materials/${mat.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-action-btn"
                          title="Download & Verify"
                        >
                          <Download size={14} />
                        </a>
                        <button
                          type="button"
                          className="admin-action-btn is-danger"
                          onClick={() => setDeleteTarget(mat)}
                          disabled={actionLoadingId === mat.id}
                          title="Delete Material"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="admin-modal-backdrop" onClick={() => !isUploading && setIsUploadOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <div>
                <h3 className="admin-modal__title">Upload Study Material</h3>
                <p className="admin-modal__subtitle">
                  Upload PDF to private Cloudflare R2 bucket and index in PostgreSQL.
                </p>
              </div>
              <button
                type="button"
                className="admin-modal__close"
                onClick={() => setIsUploadOpen(false)}
                disabled={isUploading}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpload} className="admin-modal__form">
              {uploadError && (
                <div className="admin-alert admin-alert--error">
                  <AlertCircle size={16} />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="upload-course">
                  Target Course *
                </label>
                <select
                  id="upload-course"
                  className="admin-select admin-select--full"
                  value={uploadCourse}
                  onChange={(e) => setUploadCourse(e.target.value)}
                  disabled={isUploading}
                >
                  <option value="ielts">IELTS Preparation</option>
                  <option value="oet">OET Preparation</option>
                  <option value="pte">PTE Academic</option>
                  <option value="german">German Language</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="upload-title">
                  Title *
                </label>
                <input
                  id="upload-title"
                  type="text"
                  className="admin-input admin-input--full"
                  placeholder="e.g. IELTS Writing Task 2 Model Essays"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  disabled={isUploading}
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="upload-desc">
                  Description (optional)
                </label>
                <textarea
                  id="upload-desc"
                  className="admin-textarea admin-textarea--full"
                  placeholder="Summary of topics, band score guidance, or notes."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  disabled={isUploading}
                  rows={3}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-label" htmlFor="upload-file">
                  PDF Document (Max 25MB) *
                </label>
                <input
                  id="upload-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  className="admin-file-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setUploadFile(f);
                    if (f && !uploadTitle) {
                      // Pre-fill title from clean filename
                      setUploadTitle(f.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " "));
                    }
                  }}
                  disabled={isUploading}
                  required
                />
                {uploadFile && (
                  <p className="admin-file-info">
                    Selected: <strong>{uploadFile.name}</strong> ({formatBytes(uploadFile.size)})
                  </p>
                )}
              </div>

              <div className="admin-form-row">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={uploadPublished}
                    onChange={(e) => setUploadPublished(e.target.checked)}
                    disabled={isUploading}
                  />
                  <span>Publish immediately to students</span>
                </label>

                <div className="admin-form-inline">
                  <label htmlFor="upload-order">Display order:</label>
                  <input
                    id="upload-order"
                    type="number"
                    className="admin-input admin-input--sm"
                    value={uploadOrder}
                    onChange={(e) => setUploadOrder(parseInt(e.target.value, 10) || 0)}
                    disabled={isUploading}
                    min={0}
                  />
                </div>
              </div>

              <div className="admin-modal__footer">
                <button
                  type="button"
                  className="admin-btn admin-btn--outline"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={isUploading || !uploadFile}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="admin-spin" />
                      <span>Uploading to R2...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>Upload Material</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="admin-modal admin-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal__header">
              <h3 className="admin-modal__title">Confirm Material Deletion</h3>
              <button
                type="button"
                className="admin-modal__close"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal__body">
              <p>Are you sure you want to permanently delete:</p>
              <blockquote className="admin-quote">
                <strong>{deleteTarget.title}</strong>
                <p className="admin-table__subtext">Course: {deleteTarget.courseSlug.toUpperCase()}</p>
              </blockquote>
              <p className="admin-warning-text">
                This will delete the database record AND permanently purge the file from private Cloudflare R2 storage.
              </p>
            </div>

            <div className="admin-modal__footer">
              <button
                type="button"
                className="admin-btn admin-btn--outline"
                onClick={() => setDeleteTarget(null)}
                disabled={actionLoadingId === deleteTarget.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={confirmDelete}
                disabled={actionLoadingId === deleteTarget.id}
              >
                {actionLoadingId === deleteTarget.id ? (
                  <>
                    <Loader2 size={15} className="admin-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
