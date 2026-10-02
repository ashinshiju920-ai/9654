import { Suspense } from 'react';
import { StudentManager } from './student-manager';

export const metadata = {
  title: 'Students & Users - Aylem Admin',
  description: 'Manage registered students, account status, and sessions'
};

export default function StudentsPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900, #062a52)' }}>
          Student &amp; User Accounts
        </h1>
        <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Inspect registered accounts, manage access status, view email verification states, and revoke compromised sessions.
        </p>
      </div>

      <Suspense fallback={<div className="admin-loading">Loading student records...</div>}>
        <StudentManager />
      </Suspense>
    </div>
  );
}
