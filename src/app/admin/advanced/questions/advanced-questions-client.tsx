"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Edit2, HelpCircle, Plus, RefreshCw, Trash2 } from "lucide-react";

type CollectionOption = {
  id: string;
  courseName: string;
  courseSlug: string;
  title: string;
  slug: string;
};

type AdvancedQuestion = {
  id: string;
  collectionId: string;
  collectionTitle: string;
  courseSlug: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
  isActive: boolean;
};

type FormState = {
  collectionId: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  collectionId: "",
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
  explanation: "",
  isActive: true,
};

export function AdvancedQuestionsClient() {
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [questions, setQuestions] = useState<AdvancedQuestion[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdvancedQuestion | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const loadCollections = useCallback(async () => {
    const res = await fetch("/api/admin/advanced/collections");
    const data = (await res.json()) as { collections?: CollectionOption[]; error?: string };
    if (!res.ok) throw new Error(data.error || "Failed to load collections.");
    setCollections(data.collections || []);
    if (!form.collectionId && data.collections?.[0]) {
      setForm((prev) => ({ ...prev, collectionId: data.collections![0].id }));
    }
  }, [form.collectionId]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (selectedCollection !== "all") params.set("collectionId", selectedCollection);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/advanced/questions?${params.toString()}`);
      const data = (await res.json()) as {
        questions?: AdvancedQuestion[];
        pagination?: { page: number; totalPages: number; total: number };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Failed to load questions.");
      setQuestions(data.questions || []);
      setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load questions.");
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCollection]);

  useEffect(() => {
    void Promise.resolve()
      .then(loadCollections)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load collections."));
  }, [loadCollections]);

  useEffect(() => {
    void Promise.resolve().then(loadQuestions);
  }, [loadQuestions]);

  const resetForm = () => {
    setEditing(null);
    setForm({ ...emptyForm, collectionId: collections[0]?.id || "" });
  };

  const saveQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const endpoint = editing ? `/api/admin/advanced/questions/${editing.id}` : "/api/admin/advanced/questions";
      const res = await fetch(endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to save question.");
      setMessage(editing ? "Advanced question updated." : "Advanced question created.");
      resetForm();
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save question.");
    }
  };

  const removeQuestion = async (question: AdvancedQuestion) => {
    if (!confirm("Remove this Advanced question? Used questions will be archived instead.")) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/advanced/questions/${question.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Failed to remove question.");
      setMessage(data.message || "Advanced question removed.");
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove question.");
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
      {error && (
        <div className="admin-alert admin-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form className="admin-card" onSubmit={saveQuestion}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem" }}>
          {editing ? "Edit Advanced Question" : "Add Advanced Question"}
        </h2>
        <div className="admin-form-group">
          <label className="admin-label">Advanced Collection</label>
          <select
            className="admin-select"
            required
            value={form.collectionId}
            onChange={(event) => setForm((prev) => ({ ...prev, collectionId: event.target.value }))}
          >
            <option value="">Select collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.courseSlug.toUpperCase()} - {collection.title}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Question Text</label>
          <textarea
            className="admin-textarea"
            required
            rows={3}
            value={form.questionText}
            onChange={(event) => setForm((prev) => ({ ...prev, questionText: event.target.value }))}
          />
        </div>
        <div className="admin-options-grid">
          {(["A", "B", "C", "D"] as const).map((option) => (
            <div className="admin-form-group" key={option}>
              <label className="admin-label">Option {option}</label>
              <input
                className="admin-input"
                required
                value={form[`option${option}`]}
                onChange={(event) => setForm((prev) => ({ ...prev, [`option${option}`]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-label">Correct Option</label>
            <select
              className="admin-select"
              value={form.correctOption}
              onChange={(event) => setForm((prev) => ({ ...prev, correctOption: event.target.value as FormState["correctOption"] }))}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          <label className="admin-form-group" style={{ justifyContent: "end" }}>
            <span className="admin-label">Active</span>
            <input
              checked={form.isActive}
              type="checkbox"
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
          </label>
        </div>
        <div className="admin-form-group">
          <label className="admin-label">Explanation</label>
          <textarea
            className="admin-textarea"
            rows={2}
            value={form.explanation}
            onChange={(event) => setForm((prev) => ({ ...prev, explanation: event.target.value }))}
          />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          {editing && (
            <button className="admin-btn admin-btn-secondary" type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
          <button className="admin-btn admin-btn-primary" type="submit">
            <Plus size={16} />
            {editing ? "Save Question" : "Add Question"}
          </button>
        </div>
      </form>

      <div className="admin-card">
        <div className="admin-actions-bar">
          <div className="admin-search-group">
            <input
              className="admin-input"
              placeholder="Search Advanced questions..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              className="admin-select"
              value={selectedCollection}
              onChange={(event) => {
                setSelectedCollection(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Collections</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.courseSlug.toUpperCase()} - {collection.title}
                </option>
              ))}
            </select>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={loadQuestions} type="button">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="admin-loading-state">Loading questions...</div>
        ) : questions.length === 0 ? (
          <div className="admin-empty-state">
            <HelpCircle size={36} />
            <p>No Advanced questions found.</p>
          </div>
        ) : (
          <>
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Collection</th>
                    <th>Question</th>
                    <th>Answer</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((question) => (
                    <tr key={question.id}>
                      <td>
                        <span className="admin-badge admin-badge-neutral">
                          {question.courseSlug.toUpperCase()}
                        </span>
                      </td>
                      <td>{question.collectionTitle}</td>
                      <td>
                        <strong>{question.questionText}</strong>
                        {question.explanation && (
                          <div style={{ color: "var(--slate-500)", fontSize: "0.75rem" }}>
                            {question.explanation}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="admin-correct-pill">Option {question.correctOption}</span>
                      </td>
                      <td>
                        <span className={`admin-badge ${question.isActive ? "admin-badge-success" : "admin-badge-archived"}`}>
                          {question.isActive ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-row-actions">
                          <button
                            className="admin-icon-btn"
                            type="button"
                            onClick={() => {
                              setEditing(question);
                              setForm({
                                collectionId: question.collectionId,
                                questionText: question.questionText,
                                optionA: question.optionA,
                                optionB: question.optionB,
                                optionC: question.optionC,
                                optionD: question.optionD,
                                correctOption: question.correctOption,
                                explanation: question.explanation || "",
                                isActive: question.isActive,
                              });
                            }}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="admin-icon-btn admin-icon-btn-danger"
                            type="button"
                            onClick={() => removeQuestion(question)}
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
            <div className="admin-pagination">
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} questions)
              </span>
              <div className="admin-pagination-controls">
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
