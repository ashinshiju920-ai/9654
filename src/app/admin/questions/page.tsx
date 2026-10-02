import { Suspense } from 'react';
import { QuestionManager } from './question-manager';

export const metadata = {
  title: 'Question Banks - Aylem Admin',
  description: 'Manage practice quiz questions and bulk import CSV'
};

export default function QuestionsPage() {
  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy-900, #062a52)' }}>
          Question Bank Management
        </h1>
        <p style={{ color: 'var(--slate-500, #64748b)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Create, edit, archive, and import questions for IELTS, OET, PTE, and German practice quizzes.
        </p>
      </div>

      <Suspense fallback={<div className="admin-loading">Loading question bank...</div>}>
        <QuestionManager />
      </Suspense>
    </div>
  );
}
