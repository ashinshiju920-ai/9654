import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

import { requireUserOrRedirect } from "@/lib/auth";
import { courses } from "@/lib/courses";
import { coursePresentations } from "@/lib/course-presentation";

export default async function CoursesIndexPage() {
  await requireUserOrRedirect("/login");

  return (
    <div className="courses-hub">
      {/* 1. Header Hero */}
      <header className="courses-hub-hero">
        <div className="courses-hub-hero__kicker">
          <Sparkles size={16} aria-hidden="true" />
          <span>Curriculum Hub</span>
        </div>
        <h1 className="courses-hub-hero__title">Explore Our Certification Tracks</h1>
        <p className="courses-hub-hero__subtitle">
          Engineered for international higher education, healthcare migration, and European language
          mastery. Choose your track to access verified PDF study vaults and practice exams.
        </p>

        {/* Global Summary Matrix */}
        <div className="courses-hub-matrix">
          <div className="hub-stat-item">
            <strong>4 Core Tracks</strong>
            <span>IELTS · OET · PTE · German</span>
          </div>
          <div className="hub-stat-item">
            <strong>100% Verified</strong>
            <span>British Council, CBLA, Pearson &amp; Goethe</span>
          </div>
          <div className="hub-stat-item">
            <strong>Private R2 Vault</strong>
            <span>Instant, ad-free study PDF downloads</span>
          </div>
          <div className="hub-stat-item">
            <strong>Adaptive Quizzes</strong>
            <span>20, 50 &amp; 100 question drill sizes</span>
          </div>
        </div>
      </header>

      {/* 2. Course Cards Grid */}
      <section className="courses-track-grid" aria-label="Available Courses">
        {courses.map((course, idx) => {
          const presentation = coursePresentations[course.slug];
          const TrackIcon = presentation?.icon || BookOpen;
          const accentColor = presentation?.accentColor || "#0aa69a";

          return (
            <article
              className={`track-showcase-card track-showcase-card--${course.slug}`}
              key={course.slug}
              style={{
                borderTop: `4px solid ${accentColor}`,
                animationDelay: `${idx * 60}ms`,
              }}
            >
              <div className="track-showcase-card__header">
                <div
                  className="track-showcase-card__icon"
                  style={{
                    backgroundColor: `${accentColor}1c`,
                    color: accentColor,
                  }}
                >
                  <TrackIcon size={26} aria-hidden="true" />
                </div>

                <div className="track-showcase-card__badges">
                  <span
                    className="track-badge-tag"
                    style={{
                      borderColor: `${accentColor}44`,
                      color: accentColor,
                      backgroundColor: `${accentColor}12`,
                    }}
                  >
                    Track 0{idx + 1}
                  </span>
                  <span className="track-badge-standard">
                    <ShieldCheck size={12} aria-hidden="true" />
                    {presentation?.badge || "Certified Standard"}
                  </span>
                </div>
              </div>

              <div className="track-showcase-card__body">
                <h2 className="track-showcase-card__title">
                  <Link href={`/courses/${course.slug}`}>{presentation?.title || course.name}</Link>
                </h2>
                <p className="track-showcase-card__tagline">{presentation?.tagline || course.description}</p>
                <p className="track-showcase-card__desc">{presentation?.heroDescription}</p>

                {/* Key Spec Grid */}
                <div className="track-spec-grid">
                  <div className="track-spec-item">
                    <span className="track-spec-item__label">
                      <Trophy size={13} style={{ color: accentColor }} aria-hidden="true" />
                      Target
                    </span>
                    <strong className="track-spec-item__val">
                      {presentation?.benchmarkTarget || "High Score"}
                    </strong>
                  </div>

                  <div className="track-spec-item">
                    <span className="track-spec-item__label">
                      <Clock size={13} style={{ color: accentColor }} aria-hidden="true" />
                      Duration
                    </span>
                    <strong className="track-spec-item__val">{presentation?.examDuration || "2.5h"}</strong>
                  </div>

                  <div className="track-spec-item">
                    <span className="track-spec-item__label">
                      <Compass size={13} style={{ color: accentColor }} aria-hidden="true" />
                      Delivery
                    </span>
                    <strong className="track-spec-item__val">
                      {presentation?.examFormat || "Standard"}
                    </strong>
                  </div>
                </div>

                {/* Module Highlights */}
                {presentation?.modules ? (
                  <div className="track-modules-mini">
                    <span className="track-modules-mini__label">Included Modules:</span>
                    <div className="track-modules-mini__list">
                      {presentation.modules.map((m) => (
                        <span className="track-module-chip" key={m.title}>
                          <CheckCircle2 size={11} style={{ color: accentColor }} aria-hidden="true" />
                          {m.title}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="track-showcase-card__footer">
                <Link
                  className="track-showcase-card__cta"
                  href={`/courses/${course.slug}`}
                  style={{
                    backgroundColor: accentColor,
                    color: course.slug === "german" ? "#111111" : "#ffffff",
                  }}
                >
                  <span>Open {course.name} Course</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>

                <Link
                  className="track-showcase-card__mock-btn"
                  href={`/courses/${course.slug}/quiz`}
                >
                  <span>Practice Test</span>
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {/* 3. Advanced Practice Pathway */}
      <section className="courses-hub-advanced-banner" aria-label="Advanced Practice question banks">
        <div className="courses-hub-advanced-banner__content">
          <div className="courses-hub-advanced-banner__badge">
            <Sparkles size={14} aria-hidden="true" />
            <span>Advanced Practice · 10,000+ Questions</span>
          </div>
          <h2>Looking for high-intensity exam preparation?</h2>
          <p>
            Explore our advanced question banks developed from previous exam patterns and high-priority topics
            across IELTS, OET, PTE, and German.
          </p>
          <div className="courses-hub-advanced-banner__actions">
            <Link className="courses-hub-advanced-btn" href="/advanced-mock-test">
              <span>Explore Advanced Practice</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
