"use client";

import { useState } from "react";
import { Edit2, Check, X, AlertCircle } from "lucide-react";
import type { AdminCourseItem } from "@/lib/admin/queries";

export function CourseManager({ initialCourses }: { initialCourses: AdminCourseItem[] }) {
  const [courses, setCourses] = useState<AdminCourseItem[]>(initialCourses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrder, setEditOrder] = useState<number>(1);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function startEdit(course: AdminCourseItem) {
    setEditingId(course.id);
    setEditName(course.name);
    setEditOrder(course.displayOrder);
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setMessage(null);
  }

  async function saveEdit(id: string) {
    setLoadingId(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, displayOrder: editOrder }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to update course");
      }

      setCourses((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, name: editName, displayOrder: editOrder }
            : c,
        ),
      );
      setEditingId(null);
      setMessage({ type: "success", text: "Course updated successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update" });
    } finally {
      setLoadingId(null);
    }
  }

  async function toggleStatus(course: AdminCourseItem) {
    setLoadingId(course.id);
    setMessage(null);
    const newStatus = !course.isActive;

    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle status");
      }

      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, isActive: newStatus } : c)),
      );
      setMessage({
        type: "success",
        text: `Course ${course.name} is now ${newStatus ? "Active" : "Archived"}.`,
      });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to toggle" });
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card__header">
        <div>
          <h2 className="admin-card__title">Aylem Learning Courses</h2>
          <p className="admin-card__subtitle">
            Configure metadata, display order, and publishing status for core tracks.
          </p>
        </div>
      </div>

      {message && (
        <div className={`admin-alert admin-alert--${message.type}`}>
          {message.type === "error" && <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Course Name</th>
              <th>Slug</th>
              <th>Display Order</th>
              <th>Study PDFs</th>
              <th>Question Bank</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => {
              const isEditing = editingId === course.id;
              const isLoading = loadingId === course.id;

              return (
                <tr key={course.id} className={!course.isActive ? "is-dimmed" : undefined}>
                  <td>
                    {isEditing ? (
                      <input
                        type="text"
                        className="admin-input admin-input--sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        disabled={isLoading}
                      />
                    ) : (
                      <strong>{course.name}</strong>
                    )}
                  </td>
                  <td>
                    <code className="admin-code">{course.slug}</code>
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        className="admin-input admin-input--sm admin-input--num"
                        value={editOrder}
                        onChange={(e) => setEditOrder(parseInt(e.target.value, 10) || 1)}
                        min={1}
                        max={99}
                        disabled={isLoading}
                      />
                    ) : (
                      course.displayOrder
                    )}
                  </td>
                  <td>{course.materialCount} PDFs</td>
                  <td>{course.questionCount} Questions</td>
                  <td>
                    <button
                      type="button"
                      className={`admin-status-toggle ${course.isActive ? "is-active" : "is-inactive"}`}
                      onClick={() => toggleStatus(course)}
                      disabled={isLoading || isEditing}
                      title={`Click to ${course.isActive ? "archive" : "activate"}`}
                    >
                      {course.isActive ? "Active" : "Archived"}
                    </button>
                  </td>
                  <td>
                    <div className="admin-table-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="admin-btn admin-btn--xs admin-btn--primary"
                            onClick={() => saveEdit(course.id)}
                            disabled={isLoading}
                          >
                            <Check size={14} />
                            <span>Save</span>
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn--xs admin-btn--outline"
                            onClick={cancelEdit}
                            disabled={isLoading}
                          >
                            <X size={14} />
                            <span>Cancel</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn admin-btn--xs admin-btn--outline"
                          onClick={() => startEdit(course)}
                          disabled={isLoading}
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
