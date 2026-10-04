'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  HelpCircle,
  Plus,
  Search,
  Upload,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface QuestionItem {
  id: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  explanation: string | null;
  category: string | null;
  difficulty: string | null;
  isActive: boolean;
  createdAt: string;
}

interface CourseOption {
  id: string;
  title: string;
  slug: string;
  questionCount?: number;
}

export function QuestionManager() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuestionItem | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    courseId: '',
    prompt: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
    explanation: '',
    category: '',
    difficulty: 'medium'
  });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search.trim()) params.set('search', search.trim());
      if (selectedCourse !== 'all') params.set('courseId', selectedCourse);

      const res = await fetch(`/api/admin/questions?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load questions (${res.status})`);
      }
      const data = (await res.json()) as {
        questions?: QuestionItem[];
        courses?: CourseOption[];
        pagination?: { page: number; limit: number; total: number; totalPages: number };
      };
      setQuestions(data.questions || []);
      setCourses(data.courses || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading questions');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedCourse]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: limit.toString()
        });
        if (search.trim()) params.set('search', search.trim());
        if (selectedCourse !== 'all') params.set('courseId', selectedCourse);

        const res = await fetch(`/api/admin/questions?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load questions (${res.status})`);
        }
        const data = (await res.json()) as {
          questions?: QuestionItem[];
          courses?: CourseOption[];
          pagination?: { page: number; limit: number; total: number; totalPages: number };
        };
        if (active) {
          setQuestions(data.questions || []);
          setCourses(data.courses || []);
          setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Error loading questions');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [page, limit, search, selectedCourse]);

  const handleOpenAdd = () => {
    setEditingQuestion(null);
    setFormData({
      courseId: courses[0]?.id || '',
      prompt: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOption: 'A',
      explanation: '',
      category: 'General',
      difficulty: 'medium'
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingQuestion(q);
    const opts = q.options || [];
    setFormData({
      courseId: q.courseId,
      prompt: q.prompt,
      optionA: opts[0]?.text || '',
      optionB: opts[1]?.text || '',
      optionC: opts[2]?.text || '',
      optionD: opts[3]?.text || '',
      correctOption: q.correctOptionId || 'A',
      explanation: q.explanation || '',
      category: q.category || '',
      difficulty: q.difficulty || 'medium'
    });
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.prompt.trim()) {
      setFeedback({ type: 'error', message: 'Question prompt is required.' });
      return;
    }
    if (!formData.optionA.trim() || !formData.optionB.trim()) {
      setFeedback({ type: 'error', message: 'At least Option A and Option B are required.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const payload = {
      courseId: formData.courseId,
      prompt: formData.prompt.trim(),
      options: [
        { id: 'A', text: formData.optionA.trim() },
        { id: 'B', text: formData.optionB.trim() },
        ...(formData.optionC.trim() ? [{ id: 'C', text: formData.optionC.trim() }] : []),
        ...(formData.optionD.trim() ? [{ id: 'D', text: formData.optionD.trim() }] : [])
      ],
      correctOptionId: formData.correctOption,
      explanation: formData.explanation.trim() || null,
      category: formData.category.trim() || null,
      difficulty: formData.difficulty
    };

    try {
      if (editingQuestion) {
        const res = await fetch(`/api/admin/questions/${editingQuestion.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to update question');
        setFeedback({ type: 'success', message: 'Question updated successfully.' });
      } else {
        const res = await fetch('/api/admin/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to create question');
        setFeedback({ type: 'success', message: 'Question created successfully.' });
      }

      setIsModalOpen(false);
      fetchQuestions();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error saving question' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/questions/${deleteTarget.id}`, {
        method: 'DELETE'
      });
      const data = (await res.json()) as { action?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to delete question');

      setFeedback({
        type: 'success',
        message: data.action === 'archived'
          ? 'Question was archived (kept for historical student answers).'
          : 'Question deleted permanently.'
      });
      setDeleteTarget(null);
      fetchQuestions();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Error deleting question' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-question-manager">
      {feedback && (
        <div className={`admin-alert admin-alert-${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="admin-alert-dismiss">×</button>
        </div>
      )}

      {/* Question Bank Health Dashboard */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--navy-900, #062a52)', margin: 0 }}>
              Question Bank Health &amp; Mock Test Status
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)', margin: '0.2rem 0 0' }}>
              Standard Question counts and automated mock test size availability (20 / 50 / 100 questions).
            </p>
          </div>
          {selectedCourse !== 'all' && (
            <button
              onClick={() => { setSelectedCourse('all'); setPage(1); }}
              className="admin-btn admin-btn-secondary admin-btn-sm"
              style={{ fontSize: '0.75rem' }}
            >
              Clear Filter (Showing All)
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {courses.map((c) => {
            const count = c.questionCount ?? 0;
            const has20 = count >= 20;
            const has50 = count >= 50;
            const has100 = count >= 100;
            const isSelected = selectedCourse === c.id;

            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCourse(isSelected ? 'all' : c.id);
                  setPage(1);
                }}
                className={`admin-card ${isSelected ? 'admin-card-selected' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '1rem 1.25rem',
                  border: isSelected ? '2px solid var(--teal-600, #0d9488)' : '1px solid var(--slate-200, #e2e8f0)',
                  background: isSelected ? 'color-mix(in srgb, var(--teal-500) 8%, #ffffff)' : '#ffffff',
                  boxShadow: isSelected ? '0 0 0 2px rgba(13, 148, 136, 0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--navy-900, #062a52)' }}>
                    {c.title}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: 'var(--slate-100, #f1f5f9)',
                      color: 'var(--slate-600, #475569)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {c.slug}
                  </span>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Total Standard Questions</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900, #062a52)', lineHeight: 1.2 }}>
                    {count}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--slate-100, #f1f5f9)', paddingTop: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: has20 ? 'var(--teal-700, #0f766e)' : 'var(--slate-400)', fontWeight: 600 }}>
                    20 {has20 ? '✓' : '✕'}
                  </span>
                  <span style={{ color: has50 ? 'var(--teal-700, #0f766e)' : 'var(--slate-400)', fontWeight: 600 }}>
                    50 {has50 ? '✓' : '✕'}
                  </span>
                  <span style={{ color: has100 ? 'var(--teal-700, #0f766e)' : 'var(--slate-400)', fontWeight: 600 }}>
                    100 {has100 ? '✓' : '✕'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Header */}
      <div className="admin-actions-bar">
        <div className="admin-search-group">
          <div className="admin-search-input-wrap">
            <Search size={16} className="admin-search-icon" />
            <input
              type="text"
              placeholder="Search question prompts or categories..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="admin-input admin-search-input"
            />
          </div>

          <div className="admin-filter-wrap">
            <Filter size={16} />
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setPage(1);
              }}
              className="admin-select"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="admin-button-group">
          <a
            href="/api/admin/questions/template"
            download="aylem-question-template.csv"
            className="admin-btn admin-btn-secondary"
            title="Download CSV Template"
          >
            <Download size={16} />
            <span>Template</span>
          </a>

          <Link href="/admin/questions/import" className="admin-btn admin-btn-secondary">
            <Upload size={16} />
            <span>Bulk CSV Import</span>
          </Link>

          <button onClick={handleOpenAdd} className="admin-btn admin-btn-primary">
            <Plus size={16} />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Questions Table */}
      <div className="admin-card">
        {loading ? (
          <div className="admin-loading-state">
            <RefreshCw size={24} className="spin" />
            <p>Loading question bank...</p>
          </div>
        ) : error ? (
          <div className="admin-empty-state">
            <AlertCircle size={32} style={{ color: 'var(--red-500, #ef4444)' }} />
            <p>{error}</p>
            <button onClick={fetchQuestions} className="admin-btn admin-btn-secondary" style={{ marginTop: '0.75rem' }}>
              Retry
            </button>
          </div>
        ) : questions.length === 0 ? (
          <div className="admin-empty-state">
            <HelpCircle size={40} style={{ color: 'var(--slate-400, #94a3b8)' }} />
            <h3>No questions found</h3>
            <p>Get started by creating a question manually or uploading a CSV batch.</p>
            <button onClick={handleOpenAdd} className="admin-btn admin-btn-primary" style={{ marginTop: '1rem' }}>
              <Plus size={16} /> Add First Question
            </button>
          </div>
        ) : (
          <>
            <div className="admin-table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>Course</th>
                    <th style={{ width: '40%' }}>Question Prompt</th>
                    <th style={{ width: '15%' }}>Options / Answer</th>
                    <th style={{ width: '13%' }}>Difficulty / Domain</th>
                    <th style={{ width: '10%' }}>Status</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <span className="admin-badge admin-badge-neutral">{q.courseSlug.toUpperCase()}</span>
                      </td>
                      <td>
                        <div className="admin-question-prompt" title={q.prompt}>
                          {q.prompt}
                        </div>
                        {q.explanation && (
                          <div className="admin-question-explanation">
                            <strong>Note:</strong> {q.explanation}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="admin-question-options-preview">
                          <span className="admin-correct-pill">Ans: {q.correctOptionId}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>
                            ({q.options?.length || 0} options)
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className={`admin-badge admin-badge-${q.difficulty || 'medium'}`}>
                            {q.difficulty || 'medium'}
                          </span>
                          {q.category && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>
                              {q.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge ${q.isActive ? 'admin-badge-success' : 'admin-badge-archived'}`}>
                          {q.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="admin-row-actions">
                          <button
                            onClick={() => handleOpenEdit(q)}
                            className="admin-icon-btn"
                            title="Edit question"
                            aria-label={`Edit ${q.prompt.substring(0, 20)}`}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(q)}
                            className="admin-icon-btn admin-icon-btn-danger"
                            title="Delete or archive question"
                            aria-label={`Delete ${q.prompt.substring(0, 20)}`}
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

            {/* Pagination */}
            <div className="admin-pagination">
              <div className="admin-pagination-info">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} questions
              </div>
              <div className="admin-pagination-controls">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span className="admin-page-number">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => !submitting && setIsModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="admin-modal-header">
              <h3>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="admin-modal-close"
                disabled={submitting}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveQuestion}>
              <div className="admin-modal-body">
                <div className="admin-form-row">
                  <div className="admin-form-group" style={{ flex: 1 }}>
                    <label className="admin-label">Course *</label>
                    <select
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                      required
                      className="admin-select"
                      disabled={submitting}
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-form-group" style={{ flex: 1 }}>
                    <label className="admin-label">Difficulty</label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="admin-select"
                      disabled={submitting}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Category / Skill Area</label>
                  <input
                    type="text"
                    placeholder="e.g. Reading, Listening, Grammar, Vocabulary"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="admin-input"
                    disabled={submitting}
                  />
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Question Prompt *</label>
                  <textarea
                    rows={3}
                    placeholder="Enter the question text or problem statement..."
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    required
                    className="admin-textarea"
                    disabled={submitting}
                  />
                </div>

                <div className="admin-options-grid">
                  <div className="admin-form-group">
                    <label className="admin-label">Option A *</label>
                    <input
                      type="text"
                      placeholder="Choice A text"
                      value={formData.optionA}
                      onChange={(e) => setFormData({ ...formData, optionA: e.target.value })}
                      required
                      className="admin-input"
                      disabled={submitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-label">Option B *</label>
                    <input
                      type="text"
                      placeholder="Choice B text"
                      value={formData.optionB}
                      onChange={(e) => setFormData({ ...formData, optionB: e.target.value })}
                      required
                      className="admin-input"
                      disabled={submitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-label">Option C (optional)</label>
                    <input
                      type="text"
                      placeholder="Choice C text"
                      value={formData.optionC}
                      onChange={(e) => setFormData({ ...formData, optionC: e.target.value })}
                      className="admin-input"
                      disabled={submitting}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label className="admin-label">Option D (optional)</label>
                    <input
                      type="text"
                      placeholder="Choice D text"
                      value={formData.optionD}
                      onChange={(e) => setFormData({ ...formData, optionD: e.target.value })}
                      className="admin-input"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Correct Option *</label>
                  <div className="admin-radio-group">
                    {['A', 'B', 'C', 'D'].map((opt) => (
                      <label key={opt} className="admin-radio-label">
                        <input
                          type="radio"
                          name="correctOption"
                          value={opt}
                          checked={formData.correctOption === opt}
                          onChange={(e) => setFormData({ ...formData, correctOption: e.target.value })}
                          disabled={submitting}
                        />
                        <span>Option {opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Explanation / Solution Note</label>
                  <textarea
                    rows={2}
                    placeholder="Rationale shown to student after submitting their test..."
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    className="admin-textarea"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="admin-btn admin-btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingQuestion ? 'Update Question' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deleteTarget && (
        <div className="admin-modal-backdrop" onClick={() => !submitting && setDeleteTarget(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="admin-modal-header">
              <h3>Delete Question</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="admin-modal-close"
                disabled={submitting}
              >
                ×
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: 'var(--slate-700, #334155)', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                Are you sure you want to remove this question?
              </p>
              <div className="admin-confirm-target">
                &ldquo;{deleteTarget.prompt.substring(0, 100)}...&rdquo;
              </div>
              <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.8125rem', marginTop: '0.75rem' }}>
                If students have already answered this question on past Mock Tests, the system will safely archive it instead of breaking historical records.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="admin-btn admin-btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="admin-btn admin-btn-danger"
                disabled={submitting}
              >
                {submitting ? 'Processing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
