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

interface ValidRow {
  rowNumber: number;
  courseSlug: string;
  courseTitle: string;
  prompt: string;
  correctOptionId: string;
  category?: string;
  difficulty?: string;
}

interface ValidationResponse {
  valid: boolean;
  totalParsed: number;
  validCount: number;
  errorCount: number;
  errors: ValidationError[];
  validRows: ValidRow[];
}

export function CsvImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null);
  const [commitResult, setCommitResult] = useState<{ importedCount: number; rejectedCount: number } | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

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
        body: JSON.stringify({ csvContent: fileContent })
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
    if (!fileContent || !validationResult || validationResult.validCount === 0) return;

    setCommitting(true);
    setGeneralError(null);

    try {
      const res = await fetch('/api/admin/questions/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: fileContent })
      });

      const data = (await res.json()) as { importedCount: number; rejectedCount: number; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to commit import');
      }

      setCommitResult({
        importedCount: data.importedCount,
        rejectedCount: data.rejectedCount
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
            Successfully inserted <strong>{commitResult.importedCount}</strong> new questions into the database.
            {commitResult.rejectedCount > 0 && ` (${commitResult.rejectedCount} malformed rows were skipped).`}
          </p>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link href="/admin/questions" className="admin-btn admin-btn-primary">
              View Question Bank
            </Link>
            <button onClick={resetAll} className="admin-btn admin-btn-secondary">
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* Upload & Instructions Grid */}
      {!commitResult && (
        <div className="admin-importer-grid">
          {/* File Upload Box */}
          <div className="admin-card">
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--navy-900, #062a52)' }}>
              1. Select CSV Question File
            </h3>

            <div
              className="admin-dropzone"
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              <Upload size={32} style={{ color: 'var(--teal-600, #0d9488)', margin: '0 auto 0.75rem' }} />
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
                    Click to select CSV file
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
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleValidate}
                disabled={!file || validating}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--navy-900, #062a52)' }}>
                CSV Format Instructions
              </h3>
              <a
                href="/api/admin/questions/template"
                download="aylem-question-template.csv"
                className="admin-btn admin-btn-secondary admin-btn-sm"
              >
                <Download size={14} /> Download Sample CSV
              </a>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              The CSV header row must include the following column titles:
            </p>

            <div className="admin-code-snippet">
              <code>course,question,option_a,option_b,option_c,option_d,correct_option,explanation,category,difficulty</code>
            </div>

            <ul style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)', paddingLeft: '1.25rem', marginTop: '0.75rem', lineHeight: 1.6 }}>
              <li><strong>course</strong>: Course slug or title (<code>ielts</code>, <code>oet</code>, <code>pte</code>, <code>german</code>).</li>
              <li><strong>question</strong>: The prompt or question text.</li>
              <li><strong>option_a, option_b</strong>: Mandatory choices.</li>
              <li><strong>option_c, option_d</strong>: Optional choices.</li>
              <li><strong>correct_option</strong>: Must be one of <code>A</code>, <code>B</code>, <code>C</code>, or <code>D</code>.</li>
              <li><strong>difficulty</strong>: <code>easy</code>, <code>medium</code>, or <code>hard</code>.</li>
              <li>Values containing commas or quotation marks should be enclosed in double quotes.</li>
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
                Validation Summary
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)' }}>
                Parsed {validationResult.totalParsed} total rows
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="admin-stat-pill admin-stat-pill-success">
                <Check size={14} /> {validationResult.validCount} Valid
              </div>
              {validationResult.errorCount > 0 && (
                <div className="admin-stat-pill admin-stat-pill-danger">
                  <XCircle size={14} /> {validationResult.errorCount} Errors
                </div>
              )}
            </div>
          </div>

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
          {validationResult.validRows.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--navy-900, #062a52)', marginBottom: '0.5rem' }}>
                Preview of Valid Questions ({validationResult.validRows.length})
              </h4>
              <div className="admin-table-responsive" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                <table className="admin-table admin-table-sm">
                  <thead>
                    <tr>
                      <th style={{ width: '8%' }}>Row</th>
                      <th style={{ width: '15%' }}>Course</th>
                      <th style={{ width: '50%' }}>Question Prompt</th>
                      <th style={{ width: '12%' }}>Answer</th>
                      <th style={{ width: '15%' }}>Difficulty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.validRows.map((r) => (
                      <tr key={r.rowNumber}>
                        <td>#{r.rowNumber}</td>
                        <td>
                          <span className="admin-badge admin-badge-neutral">{r.courseTitle}</span>
                        </td>
                        <td>{r.prompt}</td>
                        <td>
                          <span className="admin-correct-pill">Option {r.correctOptionId}</span>
                        </td>
                        <td>
                          <span className={`admin-badge admin-badge-${r.difficulty || 'medium'}`}>
                            {r.difficulty || 'medium'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Commit Action */}
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--slate-200, #e2e8f0)', paddingTop: '1rem' }}>
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
              disabled={committing || validationResult.validCount === 0}
              className="admin-btn admin-btn-primary"
            >
              {committing ? (
                <>
                  <RefreshCw size={16} className="spin" /> Importing to Database...
                </>
              ) : (
                <>
                  <Upload size={16} /> Import {validationResult.validCount} Valid Questions
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
