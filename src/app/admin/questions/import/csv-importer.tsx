'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Download,
  ArrowLeft,
  RefreshCw,
  XCircle,
  Check
} from 'lucide-react';

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ValidatedQuestion {
  courseSlug: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string | null;
}

interface DuplicateRow {
  rowNumber: number;
  questionText: string;
  reason: string;
}

interface ValidationResponse {
  valid: boolean;
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  errorCount: number;
  importableCount: number;
  errors: ValidationError[];
  validQuestions: ValidatedQuestion[];
  duplicateRows?: DuplicateRow[];
}

type CourseSlug = 'ielts' | 'oet' | 'pte' | 'german';

interface CourseOption {
  slug: CourseSlug;
  name: string;
  code: string;
}

const COURSES: CourseOption[] = [
  { slug: 'ielts', name: 'IELTS', code: 'IELTS' },
  { slug: 'oet', name: 'OET', code: 'OET' },
  { slug: 'pte', name: 'PTE', code: 'PTE' },
  { slug: 'german', name: 'German', code: 'GERMAN' },
];

export function CsvImporter() {
  const [selectedCourse, setSelectedCourse] = useState<CourseSlug | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [commitResult, setCommitResult] = useState<{ importedCount: number; targetCourseName?: string } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCourseObj = COURSES.find((c) => c.slug === selectedCourse);
  const selectedCourseName = selectedCourseObj ? selectedCourseObj.name : '';

  // Course selection handler with course-change invalidation
  const handleCourseSelect = (slug: CourseSlug) => {
    if (selectedCourse === slug) return;

    // DESTROY / INVALIDATE EXISTING VALIDATION STATE IF CHANGED
    setSelectedCourse(slug);
    setValidationResult(null);
    setCommitResult(null);
    setGeneralError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selectedCourse) {
      setGeneralError('Please select a destination course before uploading a CSV file.');
      return;
    }

    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setGeneralError('Please upload a valid .csv file.');
      return;
    }

    setFile(selected);
    setValidationResult(null);
    setCommitResult(null);
    setGeneralError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string);
    };
    reader.readAsText(selected);
  };

  const handleValidate = async () => {
    if (!selectedCourse) {
      setGeneralError('Please select a destination course first.');
      return;
    }

    if (!fileContent) {
      setGeneralError('Please select a CSV file first.');
      return;
    }

    setValidating(true);
    setGeneralError(null);

    try {
      const res = await fetch('/api/admin/questions/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: fileContent,
          csvContent: fileContent,
          courseSlug: selectedCourse
        })
      });

      const data = (await res.json()) as ValidationResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to validate CSV file');
      }

      setValidationResult(data);
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Validation error');
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedCourse) {
      setGeneralError('Please select a destination course first.');
      return;
    }

    if (!fileContent || !validationResult || validationResult.validCount === 0 || committing) return;

    setCommitting(true);
    setGeneralError(null);

    try {
      const res = await fetch('/api/admin/questions/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: validationResult.validQuestions,
          csvText: fileContent,
          courseSlug: selectedCourse
        })
      });

      const data = (await res.json()) as { importedCount: number; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to commit import');
      }

      setCommitResult({
        importedCount: data.importedCount,
        targetCourseName: selectedCourseName
      });
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Commit error');
    } finally {
      setCommitting(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setFileContent(null);
    setValidationResult(null);
    setCommitResult(null);
    setGeneralError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="admin-importer-container">
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/questions" className="admin-back-link">
          <ArrowLeft size={16} /> Back to Question Bank
        </Link>
      </div>

      {generalError && (
        <div className="admin-alert admin-alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} />
          <span>{generalError}</span>
          <button onClick={() => setGeneralError(null)} className="admin-alert-dismiss">×</button>
        </div>
      )}

      {/* Success Banner */}
      {commitResult && (
        <div className="admin-card" style={{ borderLeft: '4px solid var(--teal-500, #0aa69a)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--teal-600, #0d9488)' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>
              Bulk Import Completed!
            </h3>
          </div>
          <p style={{ color: 'var(--slate-600, #475569)', fontSize: '0.875rem' }}>
            Successfully inserted <strong>{commitResult.importedCount}</strong> new questions into{' '}
            <strong>{commitResult.targetCourseName || selectedCourseName}</strong>.
          </p>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link
              href={selectedCourse ? `/admin/questions?course=${selectedCourse}` : '/admin/questions'}
              className="admin-btn admin-btn-primary"
            >
              View {commitResult.targetCourseName || selectedCourseName} Question Bank
            </Link>
            <button onClick={resetAll} className="admin-btn admin-btn-secondary">
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Authoritative Destination Course Selector */}
      {!commitResult && (
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--navy-900, #062a52)', margin: 0 }}>
                1. Select Destination Course
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)', margin: '0.25rem 0 0' }}>
                Only one destination course is configured per batch. All questions will be assigned exclusively to this course.
              </p>
            </div>
            {selectedCourse && (
              <span className="admin-stat-pill admin-stat-pill-success" style={{ fontSize: '0.75rem' }}>
                <Check size={12} /> Selected: {selectedCourseName}
              </span>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Destination Course"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.75rem',
              marginTop: '0.75rem'
            }}
          >
            {COURSES.map((c) => {
              const isSelected = selectedCourse === c.slug;
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  key={c.slug}
                  onClick={() => handleCourseSelect(c.slug)}
                  className={`admin-course-selector-btn ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    padding: '0.875rem 1rem',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--teal-600, #0d9488)' : '1px solid var(--slate-300, #cbd5e1)',
                    background: isSelected ? 'color-mix(in srgb, var(--teal-500) 10%, #ffffff)' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 0 0 2px rgba(13, 148, 136, 0.2)' : 'none'
                  }}
                >
                  <strong style={{ display: 'block', fontSize: '1.05rem', color: isSelected ? 'var(--teal-700, #0f766e)' : 'var(--navy-900, #062a52)' }}>
                    {c.name}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: isSelected ? 'var(--teal-700, #0f766e)' : 'var(--slate-500, #64748b)', fontWeight: isSelected ? 600 : 400 }}>
                    {isSelected ? '✓ Destination' : 'Select'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload & Instructions Grid */}
      {!commitResult && (
        <div className="admin-importer-grid">
          {/* File Upload Box */}
          <div className="admin-card" style={{ opacity: selectedCourse ? 1 : 0.65 }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--navy-900, #062a52)' }}>
              2. Upload {selectedCourseName ? `${selectedCourseName} ` : ''}CSV Question File
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)', marginBottom: '1rem' }}>
              {selectedCourse
                ? `Upload questions for ${selectedCourseName}. CSV rows do not need a course_slug column.`
                : 'Select a course above to enable file upload.'}
            </p>

            <div
              className={`admin-dropzone ${!selectedCourse ? 'is-disabled' : ''}`}
              onClick={() => {
                if (selectedCourse) fileInputRef.current?.click();
                else setGeneralError('Please select a destination course first.');
              }}
              style={{ cursor: selectedCourse ? 'pointer' : 'not-allowed' }}
            >
              <Upload size={32} style={{ color: selectedCourse ? 'var(--teal-600, #0d9488)' : 'var(--slate-400)', margin: '0 auto 0.75rem' }} />
              {file ? (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>{file.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)', marginTop: '0.25rem' }}>
                    {(file.size / 1024).toFixed(1)} KB — Click to change file
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>
                    {selectedCourse ? `Click to select ${selectedCourseName} CSV file` : 'Select a course first'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)', marginTop: '0.25rem' }}>
                    Standard UTF-8 encoded comma-separated values (.csv)
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                disabled={!selectedCourse}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleValidate}
                disabled={!selectedCourse || !file || validating}
                className="admin-btn admin-btn-primary"
              >
                {validating ? (
                  <>
                    <RefreshCw size={16} className="spin" /> Validating CSV...
                  </>
                ) : (
                  <>
                    <FileText size={16} /> Validate File &amp; Preview
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Guidelines Box */}
          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>
                CSV Format Instructions
              </h3>
              {selectedCourse ? (
                <a
                  href={`/api/admin/questions/template?course=${selectedCourse}`}
                  download={`aylem-${selectedCourse}-template.csv`}
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                >
                  <Download size={14} /> Download {selectedCourseName} CSV Template
                </a>
              ) : (
                <a
                  href="/api/admin/questions/template"
                  download="aylem-question-template.csv"
                  className="admin-btn admin-btn-secondary admin-btn-sm"
                >
                  <Download size={14} /> Download Sample CSV
                </a>
              )}
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              In course-specific bulk import mode, the canonical column titles are:
            </p>

            <div className="admin-code-snippet">
              <code>question_text,option_a,option_b,option_c,option_d,correct_option,explanation</code>
            </div>

            <ul style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)', paddingLeft: '1.25rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
              <li><strong>Destination Course:</strong> Because you explicitly selected <strong>{selectedCourseName || 'a destination course'}</strong>, rows do not need a <code>course_slug</code> column.</li>
              <li><strong>Backward Compatibility:</strong> If a <code>course_slug</code> column is present, every row must match <strong>{selectedCourseName || 'the selected course'}</strong>; any mismatched rows will be rejected.</li>
              <li><strong>question_text:</strong> The question prompt or text (max 2,000 characters).</li>
              <li><strong>option_a, option_b, option_c, option_d:</strong> All 4 choices are mandatory (max 500 characters each).</li>
              <li><strong>correct_option:</strong> Must be one of <code>A</code>, <code>B</code>, <code>C</code>, or <code>D</code>.</li>
              <li><strong>explanation:</strong> Optional explanation for post-submission answer review.</li>
              <li>Values containing commas, newlines, or quotes must be enclosed in double quotes.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Validation Results Section */}
      {validationResult && !commitResult && (
        <div className="admin-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--slate-200, #e2e8f0)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>
                Import Preview
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)' }}>
                Review validated questions before committing to the database
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="admin-stat-pill admin-stat-pill-success">
                <Check size={14} /> {validationResult.validCount} Valid New
              </div>
              {validationResult.duplicateCount > 0 && (
                <div className="admin-stat-pill" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                  <AlertCircle size={14} /> {validationResult.duplicateCount} Duplicates
                </div>
              )}
              {validationResult.errorCount > 0 && (
                <div className="admin-stat-pill admin-stat-pill-danger">
                  <XCircle size={14} /> {validationResult.errorCount} Errors
                </div>
              )}
            </div>
          </div>

          {/* Authoritative Destination & Summary Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--slate-200, #e2e8f0)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--slate-500, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destination Course</span>
              <strong style={{ display: 'block', fontSize: '1.125rem', color: 'var(--navy-900, #062a52)' }}>{selectedCourseName}</strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--slate-200, #e2e8f0)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--slate-500, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filename</span>
              <strong style={{ display: 'block', fontSize: '0.875rem', color: 'var(--navy-900, #062a52)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file?.name}>
                {file?.name || 'Uploaded CSV'}
              </strong>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--slate-200, #e2e8f0)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--slate-500, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Rows</span>
              <strong style={{ display: 'block', fontSize: '1.125rem', color: 'var(--navy-900, #062a52)' }}>{validationResult.totalRows}</strong>
            </div>
            <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
              <span style={{ fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valid New</span>
              <strong style={{ display: 'block', fontSize: '1.125rem', color: '#15803d' }}>{validationResult.validCount}</strong>
            </div>
            <div style={{ background: validationResult.duplicateCount > 0 ? '#fffbeb' : '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: validationResult.duplicateCount > 0 ? '1px solid #fde68a' : '1px solid var(--slate-200, #e2e8f0)' }}>
              <span style={{ fontSize: '0.7rem', color: validationResult.duplicateCount > 0 ? '#92400e' : 'var(--slate-500, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duplicates</span>
              <strong style={{ display: 'block', fontSize: '1.125rem', color: validationResult.duplicateCount > 0 ? '#b45309' : 'var(--slate-400)' }}>{validationResult.duplicateCount}</strong>
            </div>
            <div style={{ background: validationResult.invalidCount > 0 ? '#fef2f2' : '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: validationResult.invalidCount > 0 ? '1px solid #fecaca' : '1px solid var(--slate-200, #e2e8f0)' }}>
              <span style={{ fontSize: '0.7rem', color: validationResult.invalidCount > 0 ? '#991b1b' : 'var(--slate-500, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invalid</span>
              <strong style={{ display: 'block', fontSize: '1.125rem', color: validationResult.invalidCount > 0 ? '#dc2626' : 'var(--slate-400)' }}>{validationResult.invalidCount}</strong>
            </div>
            <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '0.7rem', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Importable Total</span>
              <strong style={{ display: 'block', fontSize: '1.125rem', color: '#1d4ed8' }}>{validationResult.validCount}</strong>
            </div>
          </div>

          {/* Duplicates List */}
          {validationResult.duplicateRows && validationResult.duplicateRows.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--amber-700, #b45309)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} /> Duplicates Detected ({validationResult.duplicateRows.length}) — Omitted from Import
              </h4>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.75rem 1rem', maxHeight: '180px', overflowY: 'auto' }}>
                {validationResult.duplicateRows.map((dup, i) => (
                  <div key={i} style={{ fontSize: '0.8125rem', color: '#92400e', padding: '0.35rem 0', borderBottom: i < (validationResult.duplicateRows?.length ?? 0) - 1 ? '1px dashed #fef3c7' : 'none' }}>
                    <strong>Row {dup.rowNumber}:</strong> {dup.reason}
                    <div style={{ color: '#78350f', fontSize: '0.75rem', marginTop: '0.1rem', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      &ldquo;{dup.questionText}&rdquo;
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors List */}
          {validationResult.errors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--red-600, #dc2626)', marginBottom: '0.5rem' }}>
                Rows with Validation Errors ({validationResult.errors.length})
              </h4>
              <div className="admin-error-box">
                {validationResult.errors.map((err, i) => (
                  <div key={i} className="admin-error-item">
                    <strong>Row {err.row}</strong> [{err.field}]: {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid Rows Preview */}
          {validationResult.validQuestions.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--navy-900, #062a52)', marginBottom: '0.5rem' }}>
                Preview of Valid Questions ({validationResult.validQuestions.length})
              </h4>
              <div className="admin-table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="admin-table admin-table-sm">
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>#</th>
                      <th style={{ width: '48%' }}>Question Text</th>
                      <th style={{ width: '32%' }}>Options</th>
                      <th style={{ width: '12%' }}>Answer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.validQuestions.map((q, idx) => (
                      <tr key={idx}>
                        <td>#{idx + 1}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--navy-900, #062a52)' }}>{q.questionText}</div>
                          {q.explanation && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)', marginTop: '0.2rem' }}>
                              <em>Note: {q.explanation}</em>
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem' }}>
                            <span><strong>A:</strong> {q.optionA}</span>
                            <span><strong>B:</strong> {q.optionB}</span>
                            <span><strong>C:</strong> {q.optionC}</span>
                            <span><strong>D:</strong> {q.optionD}</span>
                          </div>
                        </td>
                        <td>
                          <span className="admin-correct-pill">Option {q.correctOption}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Content Quality Warning & Commit Action */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--slate-200, #e2e8f0)', paddingTop: '1.25rem' }}>
            <div style={{ background: '#f8fafc', border: '1px solid var(--slate-300, #cbd5e1)', borderRadius: '6px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <AlertCircle size={18} style={{ color: 'var(--teal-600, #0d9488)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--slate-700, #334155)', lineHeight: 1.4 }}>
                Importing confirms that you have reviewed the questions, answer keys and explanations for accuracy.
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={resetAll}
              className="admin-btn admin-btn-secondary"
              disabled={committing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || validationResult.validCount === 0 || !selectedCourse}
              className="admin-btn admin-btn-primary"
            >
              {committing ? (
                <>
                  <RefreshCw size={16} className="spin" /> Importing to {selectedCourseName}...
                </>
              ) : (
                <>
                  <Upload size={16} /> Import {validationResult.validCount} Questions to {selectedCourseName}
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
