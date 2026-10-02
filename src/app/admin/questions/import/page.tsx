import { Suspense } from 'react';
import { CsvImporter } from './csv-importer';

export const metadata = {
  title: 'Bulk Question Import - Aylem Admin',
  description: 'Upload and validate question CSV batches'
};

export default function QuestionImportPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900, #062a52)' }}>
          Bulk Question Import (CSV)
        </h1>
        <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Import batches of practice questions for IELTS, OET, PTE, and German with strict server-side validation.
        </p>
      </div>

      <Suspense fallback={<div className="admin-loading">Loading importer...</div>}>
        <CsvImporter />
      </Suspense>
    </div>
  );
}
