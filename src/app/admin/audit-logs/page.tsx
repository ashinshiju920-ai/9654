import { Suspense } from 'react';
import { AuditLogViewer } from './audit-log-viewer';

export const metadata = {
  title: 'Audit Logs - Aylem Admin',
  description: 'Audit trail of administrative mutations'
};

export default function AuditLogsPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900, #062a52)' }}>
          Admin Audit Trail
        </h1>
        <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Record of all critical mutations performed across courses, study PDFs, question banks, and student accounts.
        </p>
      </div>

      <Suspense fallback={<div className="admin-loading">Loading audit records...</div>}>
        <AuditLogViewer />
      </Suspense>
    </div>
  );
}
