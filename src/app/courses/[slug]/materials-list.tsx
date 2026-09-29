"use client";

import { Download, FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button, EmptyState, Input } from "@/components/ui";
import { formatFileSize } from "@/lib/format";
import type { PublishedPdf } from "@/lib/types";

type MaterialsListProps = {
  pdfs: PublishedPdf[];
};

export function MaterialsList({ pdfs }: MaterialsListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");

  const filteredPdfs = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return pdfs;
    }

    return pdfs.filter((pdf) =>
      [pdf.title, pdf.description ?? ""].some((value) => value.toLowerCase().includes(normalized)),
    );
  }, [pdfs, query]);

  async function handleDownload(pdf: PublishedPdf) {
    setErrorMessage("");
    setDownloadingId(pdf.id);

    try {
      const response = await fetch(`/api/materials/${pdf.id}/download`, {
        method: "POST",
      });
      const result = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Unable to prepare this download.");
      }

      window.location.assign(result.url);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to prepare this download.");
    } finally {
      setDownloadingId(null);
    }
  }

  if (pdfs.length === 0) {
    return (
      <EmptyState
        title="No study materials published yet"
        message="Published course PDFs will appear here as soon as the Aylem team adds them."
      />
    );
  }

  return (
    <div className="materials-panel">
      <Input
        aria-label="Search PDFs"
        className="materials-search"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search PDFs"
        value={query}
      />

      {errorMessage ? (
        <p className="login-form__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {filteredPdfs.length > 0 ? (
        <div className="pdf-list">
          {filteredPdfs.map((pdf) => (
            <div className="pdf-row pdf-row--material" key={pdf.id}>
              <div className="pdf-row__main">
                <strong>
                  <FileText size={17} aria-hidden="true" /> {pdf.title}
                </strong>
                {pdf.description ? <p>{pdf.description}</p> : null}
                <span>
                  PDF
                  {formatFileSize(pdf.fileSizeBytes) ? ` · ${formatFileSize(pdf.fileSizeBytes)}` : ""}
                  {" · "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                    new Date(pdf.publishedAt),
                  )}
                </span>
              </div>
              <Button
                disabled={downloadingId === pdf.id}
                onClick={() => void handleDownload(pdf)}
                size="sm"
                type="button"
                variant="secondary"
              >
                <Download size={16} aria-hidden="true" />
                {downloadingId === pdf.id ? "Preparing..." : "Download"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No matching PDFs"
          message="Try a different search term to find published study materials."
        >
          <Search size={20} aria-hidden="true" />
        </EmptyState>
      )}
    </div>
  );
}
