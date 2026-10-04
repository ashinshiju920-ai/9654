'use client';

import { useState, useEffect, useRef, useId } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Layers,
  LockKeyhole,
  RotateCcw,
  Send,
  Shuffle,
  AlertTriangle,
  XCircle,
  Eye,
  Award,
  X,
  Check
} from 'lucide-react';

import { Badge, ButtonLink, Card, CardBody, CardHeader } from '@/components/ui';
import { AdvancedPostResultPromo } from '@/components/commercial/advanced-post-result-promo';
import type { Course } from '@/lib/courses';
import { quizSizes } from '@/lib/quiz';
import type { QuizSize } from '@/lib/types';

export type PublicQuestion = {
  id: string;
  order: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

export type ReviewQuestion = PublicQuestion & {
  correctOption: string;
  explanation: string | null;
  selectedOption: string | null;
  isCorrect: boolean | null;
};

export type QuizEngineProps = {
  course: Course;
  initialAttemptId?: string;
};

export function QuizEngine({ course, initialAttemptId }: QuizEngineProps) {
  const [mode, setMode] = useState<'setup' | 'loading' | 'testing' | 'review' | 'submitted'>('setup');
  const [selectedSize, setSelectedSize] = useState<QuizSize>(20);
  const [attemptId, setAttemptId] = useState<string | null>(initialAttemptId || null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});

  // Mobile Question Navigator Drawer
  const [showMobileNavigator, setShowMobileNavigator] = useState(false);

  // Modals & submission states
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Result state
  const [attemptResult, setAttemptResult] = useState<{
    score: number;
    percentage: string;
    testSize: number;
    submittedAt?: string;
  } | null>(null);

  // Post-submission review state
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[] | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const headingId = useId();
  const questionContainerRef = useRef<HTMLDivElement>(null);

  // Suppress portal mobile bottom navigation ONLY during active test
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const isActiveTesting = mode === 'testing';
      document.body.classList.toggle('in-active-quiz', isActiveTesting);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('in-active-quiz');
      }
    };
  }, [mode]);

  // Load post-submission review
  const loadPostSubmissionReview = async (id: string) => {
    setLoadingReview(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/quizzes/${id}/review`);
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || 'Failed to load question review.');
      }
      const data = (await res.json()) as { questions: ReviewQuestion[] };
      setReviewQuestions(data.questions || []);
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Unable to load review answers.');
    } finally {
      setLoadingReview(false);
    }
  };

  // Load existing attempt on mount if attemptId provided
  useEffect(() => {
    if (!initialAttemptId) return;

    let active = true;
    const loadAttempt = async () => {
      setMode('loading');
      try {
        const res = await fetch(`/api/quizzes/${initialAttemptId}`);
        if (!res.ok) throw new Error('Attempt not found.');
        const data = (await res.json()) as {
          attempt: {
            status: string;
            score: number;
            percentage: string;
            testSize: number;
            submittedAt?: string;
          };
          questions: PublicQuestion[];
        };

        if (!active) return;

        if (data.attempt.status === 'submitted') {
          setAttemptId(initialAttemptId);
          setAttemptResult({
            score: data.attempt.score,
            percentage: data.attempt.percentage,
            testSize: data.attempt.testSize,
            submittedAt: data.attempt.submittedAt
          });
          setMode('submitted');
          void loadPostSubmissionReview(initialAttemptId);
        } else {
          setAttemptId(initialAttemptId);
          setQuestions(data.questions || []);
          try {
            const saved = sessionStorage.getItem(`aylem_quiz_answers_${initialAttemptId}`);
            if (saved) {
              setAnswers(JSON.parse(saved));
            }
          } catch {
            // ignore storage errors
          }
          setMode('testing');
        }
      } catch (err: unknown) {
        if (active) {
          setSetupError(err instanceof Error ? err.message : 'Unable to restore attempt.');
          setMode('setup');
        }
      }
    };

    void loadAttempt();
    return () => {
      active = false;
    };
  }, [initialAttemptId]);

  // Save answers to sessionStorage whenever changed
  useEffect(() => {
    if (attemptId && mode === 'testing') {
      try {
        sessionStorage.setItem(`aylem_quiz_answers_${attemptId}`, JSON.stringify(answers));
      } catch {
        // ignore
      }
    }
  }, [answers, attemptId, mode]);

  // Start new attempt
  const handleStartTest = async () => {
    setSetupError(null);
    setMode('loading');

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseSlug: course.slug,
          testSize: selectedSize
        })
      });

      const data = (await res.json()) as {
        attemptId: string;
        questions: PublicQuestion[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create quiz attempt.');
      }

      setAttemptId(data.attemptId);
      setQuestions(data.questions || []);
      setAnswers({});
      setCurrentIndex(0);
      setMode('testing');

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('attemptId', data.attemptId);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start quiz.';
      if (msg.toLowerCase().includes('not enough questions')) {
        setSetupError(
          `The requested test size (${selectedSize} questions) is currently not available because the question bank does not contain enough active questions. Please select a smaller test size.`
        );
      } else {
        setSetupError(msg);
      }
      setMode('setup');
    }
  };

  // Select an option
  const handleSelectOption = (option: 'A' | 'B' | 'C' | 'D') => {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: option
    }));
  };

  // Jump to specific question with viewport scroll
  const handleJumpToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
      setMode('testing');
      setShowMobileNavigator(false);

      if (typeof window !== 'undefined') {
        if (questionContainerRef.current) {
          questionContainerRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'instant' });
        }
      }
    }
  };

  // Submit test
  const handleConfirmSubmit = async () => {
    if (!attemptId || submitting) return;

    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      setSubmitError(`Please answer all ${questions.length} questions before submitting.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const formattedAnswers = questions.map((q) => ({
      questionId: q.id,
      selectedOption: answers[q.id]
    }));

    try {
      const res = await fetch(`/api/quizzes/${attemptId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: formattedAnswers })
      });

      const data = (await res.json()) as {
        attempt: {
          score: number;
          percentage: string;
          testSize: number;
          submittedAt?: string;
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit quiz attempt.');
      }

      try {
        sessionStorage.removeItem(`aylem_quiz_answers_${attemptId}`);
      } catch {
        // ignore
      }

      setAttemptResult({
        score: data.attempt.score,
        percentage: data.attempt.percentage,
        testSize: data.attempt.testSize,
        submittedAt: data.attempt.submittedAt
      });

      setShowSubmitModal(false);
      setMode('submitted');
      void loadPostSubmissionReview(attemptId);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const answeredCount = Object.keys(answers).length;
  const remainingCount = Math.max(0, questions.length - answeredCount);
  const currentQuestion = questions[currentIndex];
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  // Unanswered question indices for review
  const unansweredIndices = questions
    .map((q, idx) => (!answers[q.id] ? idx : -1))
    .filter((idx) => idx !== -1);

  // ==========================================
  // RENDER: LOADING STATE
  // ==========================================
  if (mode === 'loading') {
    return (
      <div className={`page quiz-page quiz-page--${course.slug}`}>
        <Card className="mock-test-card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
          <div className="admin-loading-state">
            <Clock3 size={36} className="spin" style={{ color: 'var(--quiz-accent)' }} />
            <h2 style={{ marginTop: '1rem', color: 'var(--quiz-ink)' }}>Preparing Your Mock Test...</h2>
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>
              Randomizing questions and creating a secure, locked attempt.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ==========================================
  // RENDER: SETUP STATE
  // ==========================================
  if (mode === 'setup') {
    return (
      <div className={`page quiz-page quiz-page--${course.slug}`}>
        <section className="page-header quiz-hero">
          <div>
            <p className="page-kicker">Standard Mock Test</p>
            <h1 className="page-title">{course.name} Standard Practice</h1>
            <p className="page-subtitle">
              Choose a question set, begin a locked attempt, and practise with the same focused flow
              used for your course preparation.
            </p>
          </div>
          <div className="quiz-hero__meta" aria-label="Mock Test features">
            <span>
              <Shuffle size={16} aria-hidden="true" />
              Shuffled
            </span>
            <span>
              <LockKeyhole size={16} aria-hidden="true" />
              Locked attempt
            </span>
            <span>
              <CheckCircle2 size={16} aria-hidden="true" />
              Scored
            </span>
          </div>
        </section>

        {setupError && (
          <div className="admin-alert admin-alert-error" style={{ maxWidth: '960px', margin: '0 auto 1.5rem' }}>
            <AlertTriangle size={18} />
            <span>{setupError}</span>
            <button onClick={() => setSetupError(null)} className="admin-alert-dismiss">×</button>
          </div>
        )}

        <section className="quiz-layout">
          {/* Information Preview Card */}
          <Card className="mock-test-card mock-test-card--preview">
            <CardHeader>
              <div>
                <Badge tone="teal">Test Engine</Badge>
                <h2>Standard Mock Test Experience</h2>
                <p>Each attempt locks randomized questions fixed from the moment you begin.</p>
              </div>
              <div className="mock-test-card__icon">
                <BookOpenCheck size={24} aria-hidden="true" />
              </div>
            </CardHeader>
            <CardBody>
              <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--teal-600)' }} />
                  <span>Choose between 20, 50, or 100 questions.</span>
                </li>
                <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--teal-600)' }} />
                  <span>Jump between questions freely with the Question Navigator.</span>
                </li>
                <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--teal-600)' }} />
                  <span>Review all answers before final server-side submission.</span>
                </li>
                <li style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--teal-600)' }} />
                  <span>Comprehensive post-submission review with detailed explanations.</span>
                </li>
              </ul>
              <div className="mock-test-note">
                <Clock3 size={17} aria-hidden="true" />
                <span>Your answers remain private and secure until you choose to submit.</span>
              </div>
            </CardBody>
          </Card>

          {/* Test Setup Card */}
          <Card className="mock-test-card mock-test-card--setup">
            <CardHeader>
              <div>
                <Badge tone="navy">Start Setup</Badge>
                <h2>Choose Attempt Size</h2>
                <p>Select your question count to begin the interactive test.</p>
              </div>
              <div className="mock-test-card__icon">
                <Layers size={24} aria-hidden="true" />
              </div>
            </CardHeader>
            <CardBody>
              <div className="quiz-sizes" role="radiogroup" aria-label="Mock Test sizes">
                {quizSizes.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`quiz-size-btn ${isSelected ? 'is-selected' : ''}`}
                      style={{
                        cursor: 'pointer',
                        textAlign: 'center',
                        padding: '1rem',
                        borderRadius: 'var(--radius-md, 8px)',
                        border: isSelected ? '2px solid var(--quiz-accent)' : '1px solid var(--line, #e2e8f0)',
                        background: isSelected ? 'color-mix(in srgb, var(--quiz-accent) 10%, #ffffff)' : '#ffffff',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <strong style={{ fontSize: '1.5rem', display: 'block', color: 'var(--quiz-ink)' }}>{size}</strong>
                      <small style={{ color: 'var(--slate-500)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Questions</small>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleStartTest}
                  className="button button--primary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.875rem' }}
                >
                  <Send size={18} />
                  Start {selectedSize}-Question Mock Test
                </button>
                <ButtonLink href={`/courses/${course.slug}`} variant="secondary" style={{ justifyContent: 'center' }}>
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to {course.name}
                </ButtonLink>
              </div>
            </CardBody>
          </Card>
        </section>
      </div>
    );
  }

  // ==========================================
  // RENDER: REVIEW STATE BEFORE SUBMISSION
  // ==========================================
  if (mode === 'review') {
    return (
      <div className={`page quiz-page quiz-page--${course.slug}`}>
        <section className="quiz-review-header">
          <div className="quiz-review-header__info">
            <span className="page-kicker">Pre-Submission Check</span>
            <h1 className="page-title">Review Your Mock Test</h1>
            <p className="page-subtitle">
              Verify your chosen answers. You can tap any question below to return and revise before submitting.
            </p>
          </div>
          <div className="quiz-review-header__actions">
            <button
              type="button"
              onClick={() => handleJumpToQuestion(currentIndex)}
              className="button button--secondary"
            >
              <ArrowLeft size={16} /> Return to Test
            </button>
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="button button--primary"
            >
              <Send size={16} /> Submit Mock Test
            </button>
          </div>
        </section>

        {remainingCount > 0 && (
          <div className="quiz-unanswered-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <strong style={{ color: '#92400e', fontSize: '0.9375rem' }}>
                {remainingCount} Unanswered Question{remainingCount > 1 ? 's' : ''} Remaining
              </strong>
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#78350f' }}>
              Tap any unanswered question number below to jump directly to it and provide an answer:
            </p>
            <div className="quiz-unanswered-pills">
              {unansweredIndices.map((idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => handleJumpToQuestion(idx)}
                  className="quiz-unanswered-pill"
                  aria-label={`Jump to unanswered question ${idx + 1}`}
                >
                  Q{idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="quiz-stats-grid">
          <Card className="quiz-stat-card">
            <span className="quiz-stat-card__label">Total Questions</span>
            <strong className="quiz-stat-card__val">{questions.length}</strong>
          </Card>
          <Card className="quiz-stat-card quiz-stat-card--answered">
            <span className="quiz-stat-card__label">Answered</span>
            <strong className="quiz-stat-card__val" style={{ color: 'var(--teal-600, #0d9488)' }}>{answeredCount}</strong>
          </Card>
          <Card className={`quiz-stat-card ${remainingCount > 0 ? 'quiz-stat-card--remaining' : ''}`}>
            <span className="quiz-stat-card__label">Unanswered</span>
            <strong className="quiz-stat-card__val" style={{ color: remainingCount > 0 ? '#d97706' : 'var(--slate-400)' }}>{remainingCount}</strong>
          </Card>
        </div>

        {/* Question Review Grid */}
        <Card className="quiz-review-card">
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--quiz-ink)', margin: '0 0 1rem' }}>
            All Questions Breakdown
          </h2>
          <div className="quiz-review-grid">
            {questions.map((q, idx) => {
              const answeredOption = answers[q.id];
              return (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => handleJumpToQuestion(idx)}
                  className={`quiz-review-item ${answeredOption ? 'is-answered' : 'is-unanswered'}`}
                  aria-label={`Question ${idx + 1}: ${answeredOption ? `Answered with Option ${answeredOption}` : 'Unanswered, tap to answer'}`}
                >
                  <span className="quiz-review-item__num">Q{idx + 1}</span>
                  {answeredOption ? (
                    <strong className="quiz-review-item__ans">
                      Option {answeredOption}
                    </strong>
                  ) : (
                    <span className="quiz-review-item__warn">
                      Unanswered
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="quiz-review-footer">
            <button
              type="button"
              onClick={() => handleJumpToQuestion(currentIndex)}
              className="button button--secondary"
            >
              <ArrowLeft size={16} /> Return to Question {currentIndex + 1}
            </button>
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="button button--primary"
            >
              <Send size={16} /> Submit Mock Test
            </button>
          </div>
        </Card>

        {renderSubmitModal()}
      </div>
    );
  }

  // ==========================================
  // RENDER: RESULTS & POST-SUBMISSION REVIEW (PART C)
  // ==========================================
  if (mode === 'submitted' && attemptResult) {
    const numericPercentage = parseFloat(attemptResult.percentage) || 0;
    const isPassed = numericPercentage >= 70;

    return (
      <div className={`page quiz-page quiz-page--${course.slug}`}>
        <section className="quiz-result-hero">
          <div>
            <p className="page-kicker">Mock Test Completed</p>
            <h1 className="page-title">{course.name} Test Results</h1>
            <p className="page-subtitle">
              Your test has been verified and scored server-side.
            </p>
          </div>
          <div className="quiz-result-hero__actions">
            <button
              type="button"
              onClick={() => {
                setMode('setup');
                setAttemptId(null);
                setQuestions([]);
                setAnswers({});
                setAttemptResult(null);
                setReviewQuestions(null);
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('attemptId');
                  window.history.replaceState({}, '', url.toString());
                }
              }}
              className="button button--secondary button--sm"
            >
              <RotateCcw size={15} /> Retake Test
            </button>
            <ButtonLink href={`/results?course=${course.slug}`} variant="secondary" className="button--sm">
              <Award size={15} /> All Results
            </ButtonLink>
          </div>
        </section>

        {/* 1. SCORE, 2. PERCENTAGE, 3. READINESS STATUS, 4. PERFORMANCE MESSAGE */}
        <Card className={`quiz-readiness-card ${isPassed ? 'is-passed' : 'is-warning'}`}>
          <div className="quiz-readiness-card__top">
            <div className="quiz-readiness-card__score-block">
              <span className="quiz-readiness-card__kicker">Verified Server Score</span>
              <div className="quiz-readiness-card__score-row">
                <span className="quiz-readiness-card__fraction">
                  {attemptResult.score} <small>/ {attemptResult.testSize}</small>
                </span>
                <span className="quiz-readiness-card__pct-badge">
                  {attemptResult.percentage}%
                </span>
              </div>
            </div>

            <div className="quiz-readiness-card__status-block">
              <span
                className={`badge ${isPassed ? 'badge--success' : 'badge--warning'}`}
                style={{ fontSize: '0.8125rem', padding: '0.35rem 0.75rem', fontWeight: 700 }}
              >
                {isPassed ? 'Practice Benchmark Reached' : 'Needs More Preparation'}
              </span>
            </div>
          </div>

          <div className="quiz-readiness-card__content">
            <h2 className="quiz-readiness-card__headline">
              {isPassed ? 'Strong Mock-Test Performance' : "You're Not Exam-Ready Yet"}
            </h2>
            <p className="quiz-readiness-card__message">
              {isPassed
                ? 'You reached Aylem\'s 70% practice-readiness benchmark on this mock test. Keep practicing to improve consistency, accuracy and coverage before your exam.'
                : 'Based on this mock test, your score is below our 70% practice-readiness benchmark. Strengthen your weak areas and complete more focused practice before relying on this result as exam preparation.'}
            </p>
          </div>
        </Card>

        {/* 5. ANSWER REVIEW / RESULT DETAILS */}
        <Card className="quiz-answer-review-card">
          <div className="quiz-answer-review-card__header">
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--quiz-ink)', margin: 0 }}>
                Detailed Question Review
              </h2>
              <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Inspect your submitted answers alongside verified correct answers and detailed explanations.
              </p>
            </div>
            {reviewQuestions && (
              <Badge tone="teal">
                {reviewQuestions.length} Questions Reviewed
              </Badge>
            )}
          </div>

          {loadingReview ? (
            <div className="admin-loading-state" style={{ padding: '2rem 0' }}>
              <Clock3 size={28} className="spin" style={{ color: 'var(--quiz-accent)' }} />
              <p style={{ marginTop: '0.5rem', color: 'var(--slate-500)' }}>Loading question reviews...</p>
            </div>
          ) : reviewError ? (
            <div className="admin-alert admin-alert-error">
              <AlertTriangle size={18} />
              <span>{reviewError}</span>
              <button onClick={() => attemptId && loadPostSubmissionReview(attemptId)} className="admin-btn admin-btn-sm admin-btn-secondary" style={{ marginLeft: 'auto' }}>
                Retry
              </button>
            </div>
          ) : reviewQuestions && reviewQuestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {reviewQuestions.map((q, idx) => {
                const isCorrect = q.isCorrect;
                return (
                  <div
                    key={q.id}
                    className={`quiz-review-question-row ${isCorrect ? 'is-correct' : 'is-incorrect'}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-500)', letterSpacing: '0.05em' }}>
                        QUESTION {idx + 1}
                      </span>
                      <span
                        className={`badge ${isCorrect ? 'badge--success' : 'badge--danger'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {isCorrect ? (
                          <>
                            <CheckCircle2 size={12} /> Correct
                          </>
                        ) : (
                          <>
                            <XCircle size={12} /> Incorrect
                          </>
                        )}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.975rem', fontWeight: 600, color: 'var(--quiz-ink)', margin: '0 0 0.875rem', lineHeight: 1.55 }}>
                      {q.questionText}
                    </p>

                    <div className="quiz-review-options-grid">
                      {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                        const optText = q[`option${optKey}` as keyof ReviewQuestion] as string;
                        const isStudentChoice = q.selectedOption === optKey;
                        const isCorrectChoice = q.correctOption === optKey;

                        let optClass = 'quiz-review-option';
                        if (isCorrectChoice) optClass += ' is-correct-choice';
                        else if (isStudentChoice) optClass += ' is-student-choice';

                        return (
                          <div key={optKey} className={optClass}>
                            <span className="quiz-review-option__key">{optKey}.</span>
                            <span className="quiz-review-option__text">{optText}</span>
                            {isCorrectChoice && (
                              <span className="quiz-review-option__badge is-correct">
                                ✓ Correct
                              </span>
                            )}
                            {isStudentChoice && !isCorrectChoice && (
                              <span className="quiz-review-option__badge is-wrong">
                                ✗ Your Choice
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="quiz-review-explanation">
                        <strong style={{ color: 'var(--quiz-ink)' }}>Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem' }}>No question review data available.</p>
          )}
        </Card>

        {/* 6. ADVANCED PRACTICE CTA (COURSE-AWARE POST-RESULT PROMO) */}
        <AdvancedPostResultPromo
          courseName={course.name}
          courseSlug={course.slug}
          hasAttempts={true}
          percentage={numericPercentage}
        />
      </div>
    );
  }

  // ==========================================
  // RENDER: ACTIVE INTERACTIVE TEST SCREEN (PART A)
  // ==========================================
  if (!currentQuestion) {
    return (
      <div className={`page quiz-page quiz-page--${course.slug}`}>
        <Card style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '2rem' }}>
          <p>No questions found in this attempt.</p>
          <button onClick={() => setMode('setup')} className="button button--secondary" style={{ marginTop: '1rem' }}>
            Back to Setup
          </button>
        </Card>
      </div>
    );
  }

  const selectedAnswer = answers[currentQuestion.id];

  return (
    <div className={`page quiz-page quiz-page--${course.slug}`} ref={questionContainerRef}>
      {/* 1. COMPACT TEST HEADER (MOBILE & DESKTOP) */}
      <header className="quiz-compact-header">
        <div className="quiz-compact-header__row">
          <div className="quiz-compact-header__tags">
            <span className="badge badge--navy">{course.name}</span>
            <span className="badge badge--teal">Standard Mock Test</span>
          </div>
          <button
            type="button"
            onClick={() => setMode('review')}
            className="button button--secondary button--sm quiz-compact-review-btn"
            aria-label="Review test status"
          >
            <Eye size={14} /> Review ({answeredCount}/{questions.length})
          </button>
        </div>

        <div className="quiz-compact-header__status">
          <h1 className="quiz-compact-header__title" id={headingId}>
            Question {currentIndex + 1} of {questions.length}
          </h1>
          <div className="quiz-compact-header__counts">
            <span>Answered <strong>{answeredCount}</strong></span>
            <span>•</span>
            <span>Remaining <strong>{remainingCount}</strong></span>
          </div>
        </div>

        {/* 2. PROGRESS BAR */}
        <div
          className="progress-bar quiz-progress-bar"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Test progress: ${progressPercent}% complete`}
        >
          <span style={{ width: `${progressPercent}%`, transition: 'width 200ms ease' }} />
        </div>
      </header>

      {/* Main Single-Column Mobile / Two-Column Desktop Grid */}
      <div className="quiz-active-grid">
        {/* Left / Main: Question & Answer Options */}
        <div className="quiz-question-container">
          <Card className="mock-test-card quiz-question-card">
            <div className="quiz-question-card__top">
              <span className="quiz-question-card__qnumber">
                QUESTION {currentIndex + 1} OF {questions.length}
              </span>
              {selectedAnswer ? (
                <span className="admin-stat-pill admin-stat-pill-success" style={{ fontSize: '0.75rem' }}>
                  <Check size={12} /> Selected Option {selectedAnswer}
                </span>
              ) : (
                <span className="quiz-question-card__unanswered-tag">
                  Unanswered
                </span>
              )}
            </div>

            {/* 4. QUESTION PRESENTATION: Efficient width, multiline, readable */}
            <p className="quiz-question-card__text">
              {currentQuestion.questionText}
            </p>

            {/* 5. ANSWER OPTIONS: Minimum 48px touch target, full row tappable */}
            <div className="quiz-answer-options-list" role="radiogroup" aria-label={`Answer choices for question ${currentIndex + 1}`}>
              {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                const optText = currentQuestion[`option${optKey}` as keyof PublicQuestion] as string;
                const isSelected = selectedAnswer === optKey;

                return (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    key={optKey}
                    onClick={() => handleSelectOption(optKey)}
                    className={`quiz-answer-btn ${isSelected ? 'is-selected' : ''}`}
                    aria-label={`Option ${optKey}: ${optText}`}
                  >
                    <span className="quiz-answer-btn__marker">
                      {isSelected ? <Check size={14} /> : optKey}
                    </span>
                    <span className="quiz-answer-btn__text">
                      {optText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 6. PREVIOUS / NEXT CONTROLS */}
            <div className="quiz-nav-actions">
              <button
                type="button"
                onClick={() => handleJumpToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="button button--secondary quiz-nav-btn"
                aria-label="Go to previous question"
              >
                <ArrowLeft size={16} /> Previous
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => handleJumpToQuestion(currentIndex + 1)}
                    className="button button--primary quiz-nav-btn"
                    aria-label="Go to next question"
                  >
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode('review')}
                    className="button button--primary quiz-nav-btn"
                    aria-label="Review test before submitting"
                  >
                    Review Test <Eye size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* 7. MOBILE QUESTION NAVIGATOR TRIGGER (Visible on Mobile/Tablet) */}
            <div className="quiz-mobile-nav-bar">
              <div className="quiz-mobile-nav-bar__status">
                <span>Questions: <strong>{currentIndex + 1}</strong> / {questions.length}</span>
                <small>{answeredCount} answered</small>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileNavigator(true)}
                className="button button--secondary button--sm quiz-open-navigator-btn"
                aria-label="Open question navigator drawer"
              >
                <Layers size={14} /> Open Navigator
              </button>
            </div>
          </Card>
        </div>

        {/* Right / Desktop: Sticky Question Navigator Panel */}
        <aside className="quiz-desktop-navigator" aria-label="Desktop Question Navigator">
          <Card style={{ padding: '1.25rem', position: 'sticky', top: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--quiz-ink)', margin: 0 }}>
                Question Navigator
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 600 }}>
                {answeredCount}/{questions.length}
              </span>
            </div>

            {/* Accessible Legend */}
            <div className="quiz-navigator-legend">
              <span className="quiz-legend-item">
                <span className="quiz-legend-dot is-current" /> Current
              </span>
              <span className="quiz-legend-item">
                <span className="quiz-legend-dot is-answered" /> Answered
              </span>
              <span className="quiz-legend-item">
                <span className="quiz-legend-dot is-unanswered" /> Unanswered
              </span>
            </div>

            {/* Number Grid */}
            <div className="quiz-navigator-grid">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = Boolean(answers[q.id]);

                let itemClass = 'quiz-nav-grid-item';
                if (isCurrent) itemClass += ' is-current';
                else if (isAnswered) itemClass += ' is-answered';
                else itemClass += ' is-unanswered';

                return (
                  <button
                    type="button"
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={itemClass}
                    aria-label={`Question ${idx + 1}, ${isAnswered ? `Answered with Option ${answers[q.id]}` : 'Unanswered'}${isCurrent ? ', Current Question' : ''}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--line, #e2e8f0)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setMode('review')}
                className="button button--secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: '0.8125rem' }}
              >
                Review Test Overview
              </button>
            </div>
          </Card>
        </aside>
      </div>

      {/* MOBILE QUESTION NAVIGATOR DRAWER / BOTTOM SHEET */}
      {renderMobileNavigatorModal()}

      {/* 12. MOBILE SUBMISSION CONFIRMATION MODAL */}
      {renderSubmitModal()}
    </div>
  );

  // ==========================================
  // HELPER: MOBILE QUESTION NAVIGATOR DRAWER
  // ==========================================
  function renderMobileNavigatorModal() {
    if (!showMobileNavigator) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        className="quiz-mobile-nav-drawer-backdrop"
        onClick={() => setShowMobileNavigator(false)}
      >
        <div
          className="quiz-mobile-nav-drawer"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="quiz-mobile-nav-drawer__header">
            <div>
              <h2 id="mobile-nav-title" style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--quiz-ink)', margin: 0 }}>
                Question Navigator
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', margin: '0.2rem 0 0' }}>
                Answered {answeredCount} of {questions.length} questions
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileNavigator(false)}
              className="quiz-mobile-nav-drawer__close-btn"
              aria-label="Close question navigator"
            >
              <X size={20} />
            </button>
          </div>

          {/* Accessible Legend */}
          <div className="quiz-navigator-legend" style={{ margin: '0.5rem 0 1rem' }}>
            <span className="quiz-legend-item">
              <span className="quiz-legend-dot is-current" /> Current
            </span>
            <span className="quiz-legend-item">
              <span className="quiz-legend-dot is-answered" /> Answered
            </span>
            <span className="quiz-legend-item">
              <span className="quiz-legend-dot is-unanswered" /> Unanswered
            </span>
          </div>

          {/* Scrollable Questions Grid */}
          <div className="quiz-mobile-nav-drawer__grid">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = Boolean(answers[q.id]);

              let itemClass = 'quiz-nav-grid-item';
              if (isCurrent) itemClass += ' is-current';
              else if (isAnswered) itemClass += ' is-answered';
              else itemClass += ' is-unanswered';

              return (
                <button
                  type="button"
                  key={q.id}
                  onClick={() => handleJumpToQuestion(idx)}
                  className={itemClass}
                  aria-label={`Question ${idx + 1}, ${isAnswered ? `Answered with Option ${answers[q.id]}` : 'Unanswered'}${isCurrent ? ', Current Question' : ''}`}
                >
                  {isAnswered && !isCurrent ? <span className="quiz-nav-grid-item__check">✓</span> : null}
                  <span>{idx + 1}</span>
                </button>
              );
            })}
          </div>

          <div className="quiz-mobile-nav-drawer__footer">
            <button
              type="button"
              onClick={() => {
                setShowMobileNavigator(false);
                setMode('review');
              }}
              className="button button--secondary button--sm"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Review Test
            </button>
            <button
              type="button"
              onClick={() => setShowMobileNavigator(false)}
              className="button button--primary button--sm"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // HELPER: SUBMIT CONFIRMATION MODAL
  // ==========================================
  function renderSubmitModal() {
    if (!showSubmitModal) return null;

    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        className="quiz-modal-backdrop"
      >
        <Card className="quiz-submit-modal-card">
          <h2 id="submit-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--quiz-ink)', margin: '0 0 0.5rem' }}>
            Submit Mock Test?
          </h2>

          <p style={{ color: 'var(--slate-600)', fontSize: '0.9375rem', lineHeight: 1.5, margin: '0 0 1rem' }}>
            You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
          </p>

          {remainingCount > 0 ? (
            <div className="admin-alert admin-alert-warning" style={{ marginBottom: '1.25rem', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8125rem' }}>
              <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
              <span>
                You have {remainingCount} unanswered question{remainingCount > 1 ? 's' : ''}. Every question must be answered before your test can be officially scored.
              </span>
            </div>
          ) : (
            <p style={{ color: 'var(--slate-500)', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
              Once submitted, your answers will be locked and verified on the server. You will be able to review detailed explanations for all questions.
            </p>
          )}

          {submitError && (
            <div className="admin-alert admin-alert-error" style={{ marginBottom: '1rem' }}>
              <XCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                setShowSubmitModal(false);
                setSubmitError(null);
              }}
              disabled={submitting}
              className="button button--secondary"
            >
              Continue Test
            </button>
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={submitting || remainingCount > 0}
              className="button button--primary"
            >
              {submitting ? 'Submitting...' : 'Confirm & Submit'}
            </button>
          </div>
        </Card>
      </div>
    );
  }
}
