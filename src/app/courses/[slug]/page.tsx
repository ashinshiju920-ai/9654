import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

import { requireUserOrRedirect } from "@/lib/auth";
import { CourseAdvancedStrip } from "@/components/commercial/course-advanced-strip";
import { getCourse } from "@/lib/courses";
import { getCoursePresentation } from "@/lib/course-presentation";
import { canUserAccessCourse } from "@/lib/entitlements";
import { getPublishedPdfsForCourse } from "@/lib/materials";
import { MaterialsList } from "./materials-list";

type CoursePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const course = getCourse(slug);

  if (!course) {
    notFound();
  }

  const user = await requireUserOrRedirect(
    `/signup?next=${encodeURIComponent(`/courses/${slug}`)}`,
  );

  if (!(await canUserAccessCourse(user, course.slug, "STANDARD"))) {
    redirect("/dashboard?error=course-access-required");
  }

  const pdfs = await getPublishedPdfsForCourse(course.slug);
  const presentation = getCoursePresentation(course.slug);

  const TrackIcon = presentation?.icon || BookOpenCheck;
  const accentColor = presentation?.accentColor || "#0aa69a";

  return (
    <div className={`course-experience course-experience--${course.slug}`}>
      {/* 1. Track Breadcrumb */}
      <nav aria-label="Breadcrumb" className="course-breadcrumb">
        <Link className="course-breadcrumb__link" href="/dashboard">
          Dashboard
        </Link>
        <span className="course-breadcrumb__separator">/</span>
        <Link className="course-breadcrumb__link" href="/courses">
          Courses
        </Link>
        <span className="course-breadcrumb__separator">/</span>
        <span className="course-breadcrumb__current">{course.name}</span>
      </nav>

      {/* 2. Bespoke Dynamic Hero Banner */}
      <header
        className="course-hero"
        style={{
          borderTop: `4px solid ${accentColor}`,
        }}
      >
        <div className="course-hero__backdrop" />
        <div className="course-hero__content">
          <div className="course-hero__badge-row">
            <span
              className="course-track-pill"
              style={{
                backgroundColor: `${accentColor}1c`,
                borderColor: `${accentColor}44`,
                color: accentColor,
              }}
            >
              <TrackIcon size={14} aria-hidden="true" />
              {presentation?.heroKicker || "Curriculum Track"}
            </span>

            <span className="course-standard-pill">
              <ShieldCheck size={14} aria-hidden="true" />
              {presentation?.badge || "Certified Syllabus"}
            </span>
          </div>

          <h1 className="course-hero__title">{presentation?.heroHeadline || course.name}</h1>

          <p className="course-hero__tagline">{presentation?.tagline || course.description}</p>

          <p className="course-hero__description">
            {presentation?.heroDescription ||
              "Access verified study materials, structured curriculum blueprints, and randomized question banks designed to maximize your exam score."}
          </p>

          {/* Quick Metrics Bar */}
          <div className="course-hero__metrics">
            <div className="hero-metric-tile">
              <span className="hero-metric-tile__label">
                <Trophy size={14} style={{ color: accentColor }} aria-hidden="true" />
                Target Benchmark
              </span>
              <strong className="hero-metric-tile__value">
                {presentation?.benchmarkTarget || "High Band Score"}
              </strong>
            </div>

            <div className="hero-metric-tile">
              <span className="hero-metric-tile__label">
                <FileText size={14} style={{ color: accentColor }} aria-hidden="true" />
                Study Resources
              </span>
              <strong className="hero-metric-tile__value">
                {pdfs.length} {pdfs.length === 1 ? "Official PDF" : "Official PDFs"}
              </strong>
            </div>

            <div className="hero-metric-tile">
              <span className="hero-metric-tile__label">
                <Clock size={14} style={{ color: accentColor }} aria-hidden="true" />
                Exam Duration
              </span>
              <strong className="hero-metric-tile__value">
                {presentation?.examDuration || "Standard Exam Time"}
              </strong>
            </div>

            <div className="hero-metric-tile">
              <span className="hero-metric-tile__label">
                <Compass size={14} style={{ color: accentColor }} aria-hidden="true" />
                Testing Mode
              </span>
              <strong className="hero-metric-tile__value">
                {presentation?.examFormat || "Computer / Paper"}
              </strong>
            </div>
          </div>

          {/* CTA Action Row */}
          <div className="course-hero__actions">
            <Link
              className="course-cta-primary"
              href={`/courses/${course.slug}/quiz`}
              style={{
                backgroundColor: accentColor,
                color: course.slug === "german" ? "#111111" : "#ffffff",
              }}
            >
              <Play size={18} fill="currentColor" aria-hidden="true" />
              <span>Launch Mock Test</span>
            </Link>

            <a className="course-cta-secondary" href="#study-materials">
              <FileText size={16} aria-hidden="true" />
              <span>Browse {pdfs.length} Study PDFs</span>
            </a>
          </div>
        </div>
      </header>

      {/* 3. Exam Blueprint / Curriculum Breakdown Section */}
      {presentation?.modules && presentation.modules.length > 0 ? (
        <section className="course-section" aria-labelledby="blueprint-heading">
          <div className="course-section__header">
            <div className="course-section__kicker">
              <Sparkles size={16} style={{ color: accentColor }} aria-hidden="true" />
              <span>Exam Structure</span>
            </div>
            <h2 id="blueprint-heading" className="course-section__title">
              {course.name} Examination Blueprint
            </h2>
            <p className="course-section__subtitle">
              Master each section of the test with an exact breakdown of timing, question distribution,
              and essential scoring competencies.
            </p>
          </div>

          <div className="blueprint-grid">
            {presentation.modules.map((mod, index) => {
              const ModIcon = mod.icon;
              return (
                <div
                  className="blueprint-card"
                  key={mod.title}
                  style={{
                    borderTop: `3px solid ${accentColor}`,
                  }}
                >
                  <div className="blueprint-card__header">
                    <div
                      className="blueprint-card__icon"
                      style={{
                        backgroundColor: `${accentColor}18`,
                        color: accentColor,
                      }}
                    >
                      <ModIcon size={20} aria-hidden="true" />
                    </div>
                    <span className="blueprint-card__index">Module 0{index + 1}</span>
                  </div>

                  <h3 className="blueprint-card__title">{mod.title}</h3>

                  <div className="blueprint-card__chips">
                    <span className="blueprint-chip blueprint-chip--duration">
                      <Clock size={12} aria-hidden="true" />
                      {mod.duration}
                    </span>
                    <span className="blueprint-chip blueprint-chip--items">
                      <Layers size={12} aria-hidden="true" />
                      {mod.itemsCount}
                    </span>
                  </div>

                  <p className="blueprint-card__desc">{mod.description}</p>

                  <div className="blueprint-card__skills">
                    <span className="blueprint-card__skills-label">Core Competencies:</span>
                    <div className="blueprint-skills-list">
                      {mod.focusSkills.map((skill) => (
                        <span className="blueprint-skill-tag" key={skill}>
                          <CheckCircle2 size={11} style={{ color: accentColor }} aria-hidden="true" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 4. Study Materials Vault Section */}
      <section
        className="course-section course-section--vault"
        id="study-materials"
        aria-labelledby="materials-heading"
      >
        <div className="course-section__header">
          <div className="course-section__kicker">
            <FileText size={16} style={{ color: accentColor }} aria-hidden="true" />
            <span>Resource Vault</span>
          </div>
          <h2 id="materials-heading" className="course-section__title">
            Curated Study Materials &amp; Guides
          </h2>
          <p className="course-section__subtitle">
            Every published guide for {course.name} is stored in secure, private Cloudflare R2
            storage. Instant downloads with zero advertising or watermarks.
          </p>
        </div>

        <MaterialsList
          accentColor={accentColor}
          courseSlug={course.slug}
          pdfs={pdfs}
        />
      </section>

      {/* 5. Interactive Mock Exam Hub */}
      <section className="course-section" aria-labelledby="mock-hub-heading">
        <div
          className="mock-hub-banner"
          style={{
            borderColor: `${accentColor}44`,
            background: `linear-gradient(135deg, rgba(6, 42, 82, 0.98) 0%, rgba(7, 24, 45, 0.95) 100%)`,
          }}
        >
          <div className="mock-hub-banner__header">
            <div className="mock-hub-banner__icon" style={{ backgroundColor: accentColor }}>
              <BookOpenCheck size={28} color="#ffffff" aria-hidden="true" />
            </div>

            <div>
              <span className="mock-hub-banner__badge" style={{ color: accentColor }}>
                Adaptive Question Engine
              </span>
              <h2 id="mock-hub-heading" className="mock-hub-banner__title">
                {course.name} Randomized Practice Tests
              </h2>
              <p className="mock-hub-banner__desc">
                Train under authentic exam conditions. Each attempt shuffles questions from our
                verified bank and locks your set upon generation with anti-cheat protection.
              </p>
            </div>
          </div>

          {/* Test Sizing Cards */}
          <div className="mock-sizes-grid">
            {presentation?.testSizes.map((tier) => (
              <div className="mock-size-tier" key={tier.size}>
                <div className="mock-size-tier__header">
                  <div className="mock-size-tier__count" style={{ color: accentColor }}>
                    <strong>{tier.size}</strong>
                    <small>Questions</small>
                  </div>
                  <span className="mock-size-tier__pill">
                    <Clock size={12} aria-hidden="true" />
                    {tier.durationEst}
                  </span>
                </div>

                <h4 className="mock-size-tier__title">{tier.label}</h4>
                <p className="mock-size-tier__desc">{tier.recommendation}</p>

                <Link
                  className="mock-size-tier__btn"
                  href={`/courses/${course.slug}/quiz`}
                  style={{
                    borderColor: `${accentColor}55`,
                    color: accentColor,
                  }}
                >
                  <span>Select {tier.size} Questions</span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>

          {/* Key Advantages */}
          <div className="mock-hub-banner__footer">
            <div className="mock-guarantee-item">
              <RotateCcw size={16} style={{ color: accentColor }} aria-hidden="true" />
              <span>Randomized Seeds on Every Attempt</span>
            </div>
            <div className="mock-guarantee-item">
              <Lock size={16} style={{ color: accentColor }} aria-hidden="true" />
              <span>Confidential Answer-Key Masking</span>
            </div>
            <div className="mock-guarantee-item">
              <Trophy size={16} style={{ color: accentColor }} aria-hidden="true" />
              <span>Instant Score &amp; Comprehensive Review</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5B. Course-Aware Advanced Practice Pathway */}
      <CourseAdvancedStrip
        accentColor={accentColor}
        courseName={course.name}
        courseSlug={course.slug}
      />

      {/* 6. Tactical Strategy & Pro-Tips Section */}
      {presentation?.proTips && presentation.proTips.length > 0 ? (
        <section className="course-section" aria-labelledby="protips-heading">
          <div className="course-section__header">
            <div className="course-section__kicker">
              <Lightbulb size={16} style={{ color: accentColor }} aria-hidden="true" />
              <span>Expert Strategies</span>
            </div>
            <h2 id="protips-heading" className="course-section__title">
              High-Score Tactical Tips for {course.name}
            </h2>
            <p className="course-section__subtitle">
              Insights distilled from senior Aylem Learning instructors who have guided hundreds of
              students to top percentile band scores.
            </p>
          </div>

          <div className="protips-grid">
            {presentation.proTips.map((tip, idx) => (
              <div className="protip-card" key={tip.title}>
                <div className="protip-card__top">
                  <span
                    className="protip-card__badge"
                    style={{
                      backgroundColor: `${accentColor}1a`,
                      color: accentColor,
                    }}
                  >
                    Tip 0{idx + 1} · {tip.tag}
                  </span>
                  <Lightbulb size={18} style={{ color: accentColor }} aria-hidden="true" />
                </div>
                <h3 className="protip-card__title">{tip.title}</h3>
                <p className="protip-card__body">{tip.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Footer Motivation Banner */}
      <footer className="course-footer-banner">
        <div className="course-footer-banner__text">
          <h3>Ready to assess your current readiness?</h3>
          <p>
            Start with a Quick Skill Sprint or download the official curriculum PDF study guides.
          </p>
        </div>
        <div className="course-footer-banner__actions">
          <Link
            className="course-cta-primary"
            href={`/courses/${course.slug}/quiz`}
            style={{
              backgroundColor: accentColor,
              color: course.slug === "german" ? "#111111" : "#ffffff",
            }}
          >
            <span>Start {course.name} Mock Test</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link className="course-cta-ghost" href="/support">
            <HelpCircle size={16} aria-hidden="true" />
            <span>Need Help?</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
