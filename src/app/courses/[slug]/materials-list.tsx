"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { formatFileSize } from "@/lib/format";
import type { PublishedPdf } from "@/lib/types";

type MaterialsListProps = {
  pdfs: PublishedPdf[];
  courseSlug?: string;
  accentColor?: string;
};

export function MaterialsList({
  pdfs,
  courseSlug = "ielts",
  accentColor = "#0aa69a",
}: MaterialsListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "guides" | "practice">("all");

  const filteredPdfs = useMemo(() => {
    let result = pdfs;

    if (activeFilter === "guides") {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes("guide") ||
          (p.description && p.description.toLowerCase().includes("guide")),
      );
    } else if (activeFilter === "practice") {
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes("test") ||
          p.title.toLowerCase().includes("practice") ||
          (p.description && p.description.toLowerCase().includes("practice")),
      );
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) return result;

    return result.filter((pdf) =>
      [pdf.title, pdf.description ?? ""].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [pdfs, query, activeFilter]);

  async function handleDownload(pdf: PublishedPdf) {
    setErrorMessage("");
    setDownloadingId(pdf.id);

    try {
      const response = await fetch(`/api/materials/${pdf.id}/download`, {
        method: "POST",
      });
      const result = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to generate secure download link.");
      }

      setDownloadedIds((prev) => new Set([...prev, pdf.id]));
      window.location.assign(result.url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to prepare download.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (pdfs.length === 0) {
    return (
      <div className="materials-empty-hero">
        <div className="materials-empty-hero__icon" style={{ borderColor: accentColor }}>
          <FileText size={32} style={{ color: accentColor }} aria-hidden="true" />
        </div>
        <h3>No Study Materials Published Yet</h3>
        <p>
          The Aylem Learning academic team is curating high-yield PDF guides and mock tests for this
          course. Check back shortly or explore the interactive question bank.
        </p>
      </div>
    );
  }

  return (
    <div className="materials-vault">
      {/* Search & Filter Toolbar */}
      <div className="materials-vault__toolbar">
        <div className="materials-vault__search-box">
          <Search className="materials-vault__search-icon" size={18} aria-hidden="true" />
          <input
            aria-label="Search study materials"
            className="materials-vault__search-input"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by topic, keyword, or document name..."
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear search"
              className="materials-vault__clear-btn"
              onClick={() => setQuery("")}
              type="button"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        <div className="materials-vault__filters" role="tablist" aria-label="Filter documents">
          <button
            className={`materials-filter-pill ${activeFilter === "all" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("all")}
            type="button"
          >
            All Resources ({pdfs.length})
          </button>
          <button
            className={`materials-filter-pill ${activeFilter === "guides" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("guides")}
            type="button"
          >
            <Sparkles size={13} aria-hidden="true" />
            Study Guides
          </button>
          <button
            className={`materials-filter-pill ${activeFilter === "practice" ? "is-active" : ""}`}
            onClick={() => setActiveFilter("practice")}
            type="button"
          >
            <FileCheck2 size={13} aria-hidden="true" />
            Practice Sets
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="materials-vault__alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{errorMessage}</span>
          <button
            className="materials-vault__alert-close"
            onClick={() => setErrorMessage("")}
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      {/* Results Meta */}
      <div className="materials-vault__results-meta">
        <span>
          Showing <strong>{filteredPdfs.length}</strong> of <strong>{pdfs.length}</strong> verified
          documents
        </span>
        {query ? (
          <span className="materials-vault__query-tag">
            Filter: &ldquo;{query}&rdquo;
          </span>
        ) : null}
      </div>

      {/* Grid of Elevated Material Cards */}
      {filteredPdfs.length > 0 ? (
        <div className="materials-card-grid">
          {filteredPdfs.map((pdf, idx) => {
            const isDownloading = downloadingId === pdf.id;
            const hasDownloaded = downloadedIds.has(pdf.id);

            return (
              <article
                className={`material-item-card material-item-card--${courseSlug}`}
                key={pdf.id}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="material-item-card__header">
                  <div
                    className="material-item-card__badge-icon"
                    style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
                  >
                    <FileText size={22} aria-hidden="true" />
                    <span className="material-item-card__ext">PDF</span>
                  </div>

                  <div className="material-item-card__meta-tags">
                    <span className="material-tag material-tag--verified">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Verified Curriculum
                    </span>
                    {formatFileSize(pdf.fileSizeBytes) ? (
                      <span className="material-tag material-tag--size">
                        {formatFileSize(pdf.fileSizeBytes)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="material-item-card__body">
                  <h4 className="material-item-card__title">{pdf.title}</h4>
                  <p className="material-item-card__desc">
                    {pdf.description ||
                      "Official Aylem Learning course material compiled by certified language and examination specialists."}
                  </p>
                </div>

                <div className="material-item-card__footer">
                  <span className="material-item-card__date">
                    Added{" "}
                    {new Intl.DateTimeFormat("en", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(pdf.publishedAt))}
                  </span>

                  <button
                    className={`material-download-btn ${hasDownloaded ? "is-downloaded" : ""}`}
                    disabled={isDownloading}
                    onClick={() => void handleDownload(pdf)}
                    style={{
                      borderColor: accentColor,
                      color: hasDownloaded ? "#ffffff" : accentColor,
                      backgroundColor: hasDownloaded ? accentColor : "transparent",
                    }}
                    type="button"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                        <span>Preparing Link...</span>
                      </>
                    ) : hasDownloaded ? (
                      <>
                        <CheckCircle2 size={16} aria-hidden="true" />
                        <span>Downloaded</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownToLine size={16} aria-hidden="true" />
                        <span>Download PDF</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="materials-vault__no-match">
          <Filter size={28} className="text-muted" aria-hidden="true" />
          <h4>No matching resources found</h4>
          <p>We couldn&apos;t find any documents matching your current search or filter criteria.</p>
          <button
            className="materials-vault__reset-btn"
            onClick={() => {
              setQuery("");
              setActiveFilter("all");
            }}
            type="button"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
