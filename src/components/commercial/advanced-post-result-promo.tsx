import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileCheck2,
  History,
  Layers,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";

import type { CourseSlug } from "@/lib/courses";
import { courses } from "@/lib/courses";

export type AdvancedPostResultPromoProps = {
  courseSlug?: CourseSlug;
  courseName?: string;
  hasAttempts?: boolean;
  percentage?: number | string;
};

const benefits = [
  {
    icon: History,
    title: "Previous Exam Patterns",
    desc: "Practice questions structured around recurring exam structures and question styles.",
  },
  {
    icon: Target,
    title: "High-Priority Questions",
    desc: "Focus practice on critical exam topics and commonly tested skills across test cycles.",
  },
  {
    icon: Layers,
    title: "Deeper Practice",
    desc: "Move past standard practice sets with an expanded 10,000+ question bank.",
  },
  {
    icon: FileCheck2,
    title: "Expanded Question Coverage",
    desc: "Realistic, multi-tier question pools designed for intensive score improvement.",
  },
];

export function AdvancedPostResultPromo({
  courseSlug,
  courseName,
  hasAttempts = true,
  percentage,
}: AdvancedPostResultPromoProps) {
  const activeCourse = courseSlug ? courses.find((c) => c.slug === courseSlug) : null;
  const activeName = activeCourse ? activeCourse.name : courseName || "Course";

  const targetUrl = activeCourse
    ? `/advanced-mock-test?course=${activeCourse.slug}`
    : "/advanced-mock-test";

  const numericPct = percentage !== undefined
    ? (typeof percentage === "string" ? parseFloat(percentage) : percentage)
    : null;
  const hasScore = numericPct !== null && !Number.isNaN(numericPct);
  const isBenchmarkReached = hasScore && numericPct >= 70;

  // Title & Subtitle based on score threshold
  let promoTitle = "Ready for deeper exam practice?";
  let promoSubtitle = "Continue your preparation with Advanced Practice and access our expanded exam-focused practice experience.";
  let ctaLabel = "Explore Advanced Practice";

  if (hasScore) {
    if (isBenchmarkReached) {
      promoTitle = "Push Your Score Further";
      promoSubtitle = "Challenge yourself with deeper question coverage and continue building consistency with Advanced Practice.";
      ctaLabel = activeCourse ? `Continue to ${activeName} Advanced Practice` : "Continue to Advanced Practice";
    } else {
      promoTitle = "Build Your Exam Readiness";
      promoSubtitle = "Continue with deeper practice using Aylem Advanced Practice, with expanded question coverage built around previous exam patterns, recurring question types and high-priority topics.";
      ctaLabel = activeCourse ? `Continue to ${activeName} Advanced Practice` : "Continue to Advanced Practice";
    }
  } else if (hasAttempts && activeCourse) {
    promoTitle = `Continue with ${activeName} Advanced Practice`;
    promoSubtitle = `You've completed your Standard Mock Test. Take your ${activeName} preparation to the next level with our expanded, exam-focused question bank.`;
    ctaLabel = `Explore ${activeName} Advanced Practice`;
  }

  return (
    <section
      aria-labelledby="advanced-promo-heading"
      className="advanced-post-result-promo"
    >
      <div className="advanced-post-result-promo__ambient" />
      
      <div className="advanced-post-result-promo__inner">
        {/* Top Eyebrow & Headline */}
        <div className="advanced-post-result-promo__header">
          <div className="advanced-promo-badge">
            <Sparkles size={14} aria-hidden="true" />
            <span>Advanced Practice · Next Step</span>
          </div>

          <h2 id="advanced-promo-heading" className="advanced-post-result-promo__title">
            {promoTitle}
          </h2>

          <p className="advanced-post-result-promo__subtitle">
            {promoSubtitle}
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="advanced-promo-benefits-grid">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div className="advanced-promo-benefit" key={b.title}>
                <div className="advanced-promo-benefit__icon">
                  <Icon size={18} aria-hidden="true" />
                </div>
                <div className="advanced-promo-benefit__content">
                  <h4>{b.title}</h4>
                  <p>{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Row */}
        <div className="advanced-post-result-promo__cta-row">
          <div className="advanced-promo-cta-box">
            <Link className="advanced-promo-primary-btn" href={targetUrl}>
              <BookOpenCheck size={18} aria-hidden="true" />
              <span>{ctaLabel}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>

            <span className="advanced-promo-note">
              <CheckCircle2 size={13} aria-hidden="true" />
              10,000+ Exam-Focused Questions across all modules
            </span>
          </div>

          {/* Quick Track Switcher */}
          <div className="advanced-promo-tracks-row" aria-label="Explore other tracks">
            <span className="advanced-promo-tracks-label">Available Tracks:</span>
            <div className="advanced-promo-tracks-list">
              {courses.map((c) => (
                <Link
                  className={`advanced-track-pill ${
                    activeCourse?.slug === c.slug ? "is-current" : ""
                  }`}
                  href={`/advanced-mock-test?course=${c.slug}`}
                  key={c.slug}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
