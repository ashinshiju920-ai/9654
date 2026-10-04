"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";

type CollectionOption = {
  id: string;
  courseName: string;
  courseSlug: string;
  title: string;
};

type ValidQuestion = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "A" | "B" | "C" | "D";
  explanation: string | null;
};

type ValidationResult = {
  totalRows: number;
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
  errorCount: number;
  valid: boolean;
  importableCount: number;
  errors: Array<{ row: number; field: string; message: string }>;
  validQuestions: ValidQuestion[];
  duplicateRows: Array<{ rowNumber: number; questionText: string; reason: string }>;
};

export function AdvancedCsvImporter() {
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/advanced/collections");
      const data = (await res.json()) as { collections?: CollectionOption[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load Advanced collections.");
      setCollections(data.collections || []);
      if (data.collections?.[0]) {
        setSelectedCollectionId((current) => current || data.collections![0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load collections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCollections);
  }, [loadCollections]);

  const resetFileState = () => {
    setFileName("");
    setCsvText("");
    setValidation(null);
    setMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    setError(null);
    setMessage(null);
    setValidation(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      setCsvText(String(readerEvent.target?.result || ""));
    };
    reader.readAsText(file);
  };

  const validate = async () => {
    if (!selectedCollectionId) {
      setError("Select an Advanced collection before validating.");
      return;
    }
    if (!csvText) {
      setError("Upload a CSV file before validating.");
      return;
    }
    setValidating(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/advanced/questions/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: selectedCollectionId, csvText }),
      });
      const data = (await res.json()) as ValidationResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Validation failed.");
      setValidation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to validate CSV.");
    } finally {
      setValidating(false);
    }
  };

  const commit = async () => {
    if (!validation || validation.validQuestions.length === 0 || committing) return;
    setCommitting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/advanced/questions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collectionId: selectedCollectionId,
          validQuestions: validation.validQuestions,
        }),
      });
      const data = (await res.json()) as { importedCount?: number; error?: string };
      if (!res.ok) throw new Error(data.error || "Import failed.");
      setMessage(`Imported ${data.importedCount || 0} Advanced questions into ${selectedCollection?.title || "the selected collection"}.`);
      resetFileState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to import questions.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="admin-importer-container">
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

      <div className="admin-importer-grid">
        <div className="admin-card">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            1. Choose Destination Collection
          </h2>
          <select
            className="admin-select"
            disabled={loading}
            value={selectedCollectionId}
            onChange={(event) => {
              setSelectedCollectionId(event.target.value);
              resetFileState();
            }}
          >
            <option value="">Select Advanced collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.courseSlug.toUpperCase()} - {collection.title}
              </option>
            ))}
          </select>
          <p style={{ color: "var(--slate-500)", fontSize: "0.8125rem", marginTop: "0.75rem" }}>
            The selected collection is authoritative. CSV rows cannot redirect questions to another course or collection.
          </p>
          {collections.length === 0 && !loading && (
            <Link className="admin-btn admin-btn-secondary" href="/admin/advanced/collections">
              Create a collection first
            </Link>
          )}
        </div>

        <div className="admin-card">
          <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            2. CSV Template
          </h2>
          <div className="admin-code-snippet">
            <code>question_text,option_a,option_b,option_c,option_d,correct_option,explanation</code>
          </div>
          <p style={{ color: "var(--slate-500)", fontSize: "0.8125rem", marginTop: "0.75rem" }}>
            Recommended batch: 100-250 rows. Hard maximum: 500 rows per import.
          </p>
          <a
            className="admin-btn admin-btn-secondary admin-btn-sm"
            download="aylem-advanced-practice-template.csv"
            href="/api/admin/advanced/questions/template"
          >
            <Download size={14} />
            Download Template
          </a>
        </div>
      </div>

      <div className="admin-card" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          3. Upload, Validate, Preview, Commit
        </h2>
        <div
          className="admin-dropzone"
          onClick={() => fileInputRef.current?.click()}
          style={{ cursor: selectedCollectionId ? "pointer" : "not-allowed", opacity: selectedCollectionId ? 1 : 0.6 }}
        >
          <Upload size={32} style={{ margin: "0 auto 0.75rem" }} />
          <strong>{fileName || "Click to select Advanced CSV file"}</strong>
          <div style={{ color: "var(--slate-500)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
            UTF-8 CSV with quoted commas and multiline fields supported
          </div>
          <input
            accept=".csv,text/csv"
            disabled={!selectedCollectionId}
            onChange={handleFileChange}
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
          <button className="admin-btn admin-btn-secondary" onClick={resetFileState} type="button">
            Reset
          </button>
          <button
            className="admin-btn admin-btn-primary"
            disabled={!csvText || validating}
            onClick={validate}
            type="button"
          >
            {validating ? <RefreshCw size={16} className="spin" /> : <FileSpreadsheet size={16} />}
            Validate File
          </button>
        </div>
      </div>

      {validation && (
        <div className="admin-card" style={{ marginTop: "1.25rem" }}>
          <div className="admin-actions-bar">
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700 }}>Import Preview</h2>
              <p style={{ color: "var(--slate-500)", fontSize: "0.8125rem" }}>
                Target: {selectedCollection?.courseSlug.toUpperCase()} - {selectedCollection?.title}
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <span className="admin-stat-pill admin-stat-pill-success">{validation.validCount} valid</span>
              <span className="admin-stat-pill">{validation.duplicateCount} duplicates</span>
              <span className="admin-stat-pill admin-stat-pill-danger">{validation.invalidCount} invalid</span>
            </div>
          </div>

          {(validation.errors.length > 0 || validation.duplicateRows.length > 0) && (
            <div className="admin-error-box" style={{ marginBottom: "1rem" }}>
              {validation.errors.map((err, index) => (
                <div className="admin-error-item" key={`err-${index}`}>
                  Row {err.row} [{err.field}]: {err.message}
                </div>
              ))}
              {validation.duplicateRows.map((dup) => (
                <div className="admin-error-item" key={`dup-${dup.rowNumber}`}>
                  Row {dup.rowNumber}: {dup.reason}
                </div>
              ))}
            </div>
          )}

          {validation.validQuestions.length > 0 && (
            <div className="admin-table-responsive" style={{ maxHeight: "320px", overflowY: "auto" }}>
              <table className="admin-table admin-table-sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Answer</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.validQuestions.map((question, index) => (
                    <tr key={`${question.questionText}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{question.questionText}</td>
                      <td>
                        <span className="admin-correct-pill">Option {question.correctOption}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
            <button
              className="admin-btn admin-btn-primary"
              disabled={committing || validation.validQuestions.length === 0}
              onClick={commit}
              type="button"
            >
              {committing ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />}
              Import {validation.validQuestions.length} Questions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
