import { Suspense } from 'react';
import { MaterialManager } from './material-manager';

export const metadata = {
  title: 'Materials Management - Aylem Admin',
  description: 'Manage study materials and private R2 PDF storage'
};

export default function MaterialsPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900, #062a52)' }}>
          Study Materials &amp; PDFs
        </h1>
        <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Upload study guides, mock tests, and handouts to private Cloudflare R2 storage with database synchronization.
        </p>
      </div>

      <Suspense fallback={<div className="admin-loading">Loading study materials...</div>}>
        <MaterialManager />
      </Suspense>
    </div>
  );
}
