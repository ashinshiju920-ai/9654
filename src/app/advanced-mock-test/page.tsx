import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Compass,
  Headphones,
  History,
  Layers,
  Lock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { CheckoutButton } from "@/components/commercial/checkout-button";
import { AdvancedCourseCard } from "@/components/commercial/advanced-course-card";
import { requireUserOrRedirect } from "@/lib/auth";
import { getAdvancedCatalogueStateForUser } from "@/lib/commerce/service";
import type { CourseSlug } from "@/lib/courses";
import { courses } from "@/lib/courses";

type AdvancedMockTestPageProps = {
  searchParams?: Promise<{
    course?: string;
    payment?: string;
  }>;
};

const keyBenefits = [
  {
    icon: History,
    title: "Previous Exam Patterns",
    description:
      "Practice developed around recurring exam structures, recurring question styles, and verified format variations.",
  },
  {
    icon: Target,
    title: "High-Priority Questions",
    description:
      "Focus practice on high-frequency exam topics, core competencies, and critical scoring sections.",
  },
  {
    icon: Layers,
    title: "Expanded Practice",
    description:
      "Go significantly beyond the standard question bank with 10,000+ multi-difficulty practice items.",
  },
  {
    icon: Clock,
    title: "Real Exam Preparation",
    description:
      "Build realistic exam rhythm, timing stamina, and mental agility under authentic timed simulation conditions.",
  },
  {
    icon: RefreshCw,
    title: "Updated Regularly",
    description:
      "Our curriculum team continuously updates question banks to reflect modern testing standards and syllabus evolutions.",
  },
];

const courseTrackDetails: Record<
  CourseSlug,
  {
    accentColor: string;
    summary: string;
    focusArea: string;
    depthDescription: string;
  }
> = {
  ielts: {
    accentColor: "#1d70b8",
    summary:
      "Comprehensive question bank mirroring the rigor, pacing, and question patterns of real IELTS examinations across Academic and General Training.",
    focusArea: "Band-focused Academic & General Practice",
    depthDescription: "Listening, Reading, Writing and Speaking question styles",
  },
  oet: {
    accentColor: "#0aa69a",
    summary:
      "Clinical healthcare communication practice structured around standard OET medical and nursing examination patterns and clinical dialogues.",
    focusArea: "Healthcare English Clinical Scenarios",
    depthDescription: "Profession-specific vocabulary, clinical consultations & reading extracts",
  },
  pte: {
    accentColor: "#7c3aed",
    summary:
      "High-intensity drills developed around automated scoring algorithms, repeated PTE item types, and timed computer exam pacing.",
    focusArea: "Scoring-Aware Computer-Based Drills",
    depthDescription: "Integrated Speaking, Writing, Reading & Listening algorithm patterns",
  },
  german: {
    accentColor: "#d97706",
    summary:
      "Systematic German language practice covering foundational grammar structures, reading comprehension, and standardized Goethe/telc formats.",
    focusArea: "Language Proficiency & Syntax Mastery",
    depthDescription: "Grammar accuracy, situational dialogs & formal examination tasks",
  },
};

const deliverableItems = [
  {
    icon: BookOpenCheck,
    title: "10,000+ Exam-Focused Questions",
    desc: "Vast question pools curated across all modules with detailed answer rationales and explanations.",
  },
  {
    icon: Compass,
    title: "Multi-Tier Question Sizing",
    desc: "Train in 20-question skill sprints, 50-question section benchmarks, or full 100-question endurance mocks.",
  },
  {
    icon: Zap,
    title: "Instant Scoring & Diagnostics",
    desc: "Receive real-time percentage scoring and performance reviews immediately upon test submission.",
  },
  {
    icon: ShieldCheck,
    title: "Locked Anti-Cheat Sessions",
    desc: "Each attempt freezes its shuffled question seed upon generation for distraction-free assessment.",
  },
  {
    icon: Award,
    title: "Pattern Recurrence Analysis",
    desc: "Drills structured around high-frequency question types and recurring exam patterns.",
  },
  {
    icon: Headphones,
    title: "Dedicated Aylem Academic Support",
    desc: "Guidance and curriculum updates from experienced Aylem Learning test preparation instructors.",
  },
];

export default async function AdvancedMockTestPage({ searchParams }: AdvancedMockTestPageProps) {
  const user = await requireUserOrRedirect("/signup?next=/advanced-mock-test");

  const resolvedParams = searchParams ? await searchParams : {};
  const selectedCourse = resolvedParams.course as CourseSlug | undefined;
  const isValidCourse = selectedCourse && ["ielts", "oet", "pte", "german"].includes(selectedCourse);
  const commerceByCourse = await getAdvancedCatalogueStateForUser(user);

  return (
    <div className="advanced-product-page">
      {/* 1. HERO SECTION */}
      <section className="advanced-hero-section">
        <div className="advanced-hero-section__ambient" />
        
        <div className="advanced-hero-section__inner">
          <div className="advanced-hero-header">
            {resolvedParams.payment === "success" && (
              <div className="advanced-payment-alert" role="status" aria-live="polite">
                <CheckCircle2 size={20} color="#00a66d" aria-hidden="true" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Payment Successful!</strong>
                  <span> Your ₹299 payment was confirmed via Cashfree. Advanced Practice Mock Tests are now unlocked for all courses.</span>
                </div>
              </div>
            )}

            <div className="advanced-kicker-pill">
              <Sparkles size={14} aria-hidden="true" />
              <span>ADVANCED PRACTICE</span>
            </div>

            <h1 className="advanced-hero-title">
              10,000+ Exam-Focused Questions
            </h1>

            <p className="advanced-hero-positioning">
              Developed from previous exam patterns, recurring question types and high-priority exam topics.
            </p>

            <p className="advanced-hero-description">
              Move beyond standard practice into rigorous, structured mock test training. Designed for
              students preparing for serious band scores in IELTS, OET, PTE, and German examinations.
            </p>

            {/* Quick Track Focus Tabs */}
            <div className="advanced-track-selector">
              <span className="advanced-track-selector__label">Select Track:</span>
              <div className="advanced-track-selector__pills">
                {courses.map((course) => {
                  const isCurrent = isValidCourse && selectedCourse === course.slug;
                  return (
                    <Link
                      className={`advanced-track-nav-pill ${isCurrent ? "is-active" : ""}`}
                      href={`/advanced-mock-test?course=${course.slug}#track-${course.slug}`}
                      key={course.slug}
                    >
                      <span>{course.name}</span>
                      {isCurrent && <CheckCircle2 size={12} aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Visual Showcase Framing */}
          <div className="advanced-hero-showcase">
            <div className="advanced-showcase-card">
              <div className="advanced-showcase-card__image-container">
                <Image
                  alt="Aylem Learning Advanced Practice with exam-focused questions"
                  className="advanced-showcase-card__img"
                  height={887}
                  priority
                  src="/IMG_1670.PNG"
                  unoptimized
                  width={1774}
                />
              </div>
              <div className="advanced-showcase-card__caption">
                <span className="advanced-caption-item">
                  <CheckCircle2 size={14} color="#00a66d" aria-hidden="true" />
                  Exam-Pattern Matching
                </span>
                <span className="advanced-caption-item">
                  <CheckCircle2 size={14} color="#00a66d" aria-hidden="true" />
                  High-Priority Topic Coverage
                </span>
                <span className="advanced-caption-item">
                  <CheckCircle2 size={14} color="#00a66d" aria-hidden="true" />
                  All 4 Exam Tracks
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WHAT ADVANCED PRACTICE IS */}
      <section className="advanced-section advanced-section--comparison" aria-labelledby="what-is-heading">
        <div className="advanced-section-header">
          <span className="advanced-section-kicker">Experience Comparison</span>
          <h2 id="what-is-heading" className="advanced-section-title">
            Standard Mock Tests vs. Advanced Practice
          </h2>
          <p className="advanced-section-subtitle">
            Every Aylem Learning student receives access to verified Standard Mock Tests. Advanced Practice is
            curated for candidates who need deeper question volume, recurring pattern mastery, and intensive preparation.
          </p>
        </div>

        <div className="advanced-comparison-grid">
          <div className="comparison-card comparison-card--standard">
            <div className="comparison-card__header">
              <span className="comparison-card__badge">Foundational</span>
              <h3>Standard Mock Tests</h3>
              <p>Essential curriculum verification and syllabus testing.</p>
            </div>
            <ul className="comparison-card__list">
              <li>
                <CheckCircle2 size={15} color="#0aa69a" aria-hidden="true" />
                <span>Verified questions matching core course syllabus</span>
              </li>
              <li>
                <CheckCircle2 size={15} color="#0aa69a" aria-hidden="true" />
                <span>Randomized attempt sets in 20, 50, and 100 questions</span>
              </li>
              <li>
                <CheckCircle2 size={15} color="#0aa69a" aria-hidden="true" />
                <span>Instant score calculation and percentage review</span>
              </li>
              <li>
                <CheckCircle2 size={15} color="#0aa69a" aria-hidden="true" />
                <span>Published PDF material study guidance</span>
              </li>
            </ul>
          </div>

          <div className="comparison-card comparison-card--advanced">
            <div className="comparison-card__header">
              <span className="comparison-card__badge comparison-card__badge--featured">
                <Sparkles size={12} aria-hidden="true" />
                Active Product
              </span>
              <h3>Advanced Practice</h3>
              <p>10,000+ deep question pool developed from previous exam patterns.</p>
            </div>
            <ul className="comparison-card__list">
              <li>
                <CheckCircle2 size={15} color="#1267e8" aria-hidden="true" />
                <span><strong>Previous Exam Patterns:</strong> Structured around recurring question structures</span>
              </li>
              <li>
                <CheckCircle2 size={15} color="#1267e8" aria-hidden="true" />
                <span><strong>High-Priority Focus:</strong> Emphasis on topics most frequently tested</span>
              </li>
              <li>
                <CheckCircle2 size={15} color="#1267e8" aria-hidden="true" />
                <span><strong>Expanded Depth:</strong> 10,000+ questions for extensive revision</span>
              </li>
              <li>
                <CheckCircle2 size={15} color="#1267e8" aria-hidden="true" />
                <span><strong>Real Exam Rhythm:</strong> Strict timed simulation for pacing confidence</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. KEY BENEFITS */}
      <section className="advanced-section" aria-labelledby="benefits-heading">
        <div className="advanced-section-header">
          <span className="advanced-section-kicker">Core Advantages</span>
          <h2 id="benefits-heading" className="advanced-section-title">
            Key Benefits of Advanced Practice
          </h2>
          <p className="advanced-section-subtitle">
            Professional, pattern-led preparation built to elevate your exam performance without gimmicks or guesswork.
          </p>
        </div>

        <div className="advanced-benefits-grid">
          {keyBenefits.map((b) => {
            const Icon = b.icon;
            return (
              <div className="advanced-benefit-card-clean" key={b.title}>
                <div className="advanced-benefit-card-clean__icon">
                  <Icon size={22} aria-hidden="true" />
                </div>
                <div className="advanced-benefit-card-clean__content">
                  <h3 className="advanced-benefit-card-clean__title">{b.title}</h3>
                  <p className="advanced-benefit-card-clean__desc">{b.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. COURSE SELECTION — 4 ADVANCED COURSE CARDS */}
      <section className="advanced-section" id="course-selection" aria-labelledby="courses-heading">
        <div className="advanced-section-header">
          <span className="advanced-section-kicker">Course Selection</span>
          <h2 id="courses-heading" className="advanced-section-title">
            Select Your Advanced Practice Track
          </h2>
          <p className="advanced-section-subtitle">
            Each track is structured with bespoke question patterns matching the official testing body&apos;s expectations.
          </p>
        </div>

        <div className="advanced-course-cards-grid">
          {courses.map((course) => {
            const detail = courseTrackDetails[course.slug];
            const isSelected = isValidCourse && selectedCourse === course.slug;

            return (
            <AdvancedCourseCard
                accentColor={detail.accentColor}
                courseName={course.name}
                courseSlug={course.slug}
                depthDescription={detail.depthDescription}
                focusArea={detail.focusArea}
                isSelected={isSelected}
                key={course.slug}
                priceFormatted={commerceByCourse[course.slug].priceFormatted}
                productSlug={commerceByCourse[course.slug].productSlug}
                state={commerceByCourse[course.slug].hasAccess ? "owned" : "locked"}
                summary={detail.summary}
              />
            );
          })}
        </div>
      </section>

      {/* 5. WHAT STUDENTS GET */}
      <section className="advanced-section" aria-labelledby="deliverables-heading">
        <div className="advanced-section-header">
          <span className="advanced-section-kicker">Complete Offering</span>
          <h2 id="deliverables-heading" className="advanced-section-title">
            What You Receive With Advanced Practice
          </h2>
          <p className="advanced-section-subtitle">
            A complete testing ecosystem designed to transform high-intensity revision into confident exam day execution.
          </p>
        </div>

        <div className="advanced-deliverables-grid">
          {deliverableItems.map((item) => {
            const Icon = item.icon;
            return (
              <div className="advanced-deliverable-item" key={item.title}>
                <div className="advanced-deliverable-item__icon">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <div className="advanced-deliverable-item__text">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. UNLOCK CTA SECTION */}
      <section className="advanced-unlock-section" id="unlock-access" aria-labelledby="unlock-heading">
        <div className="advanced-unlock-section__ambient" />
        
        <div className="advanced-unlock-section__content">
          <div className="advanced-unlock-badge">
            <Lock size={14} aria-hidden="true" />
            <span>Account Activation</span>
          </div>

          <h2 id="unlock-heading" className="advanced-unlock-title">
            Unlock Advanced Practice For Your Course
          </h2>

          <p className="advanced-unlock-description">
            Ready to upgrade your exam preparation? Request account activation through Aylem Learning support.
            Our team will connect your student profile with the expanded question bank for your selected track.
          </p>

          <div className="advanced-unlock-actions">
            {isValidCourse && commerceByCourse[selectedCourse].hasAccess ? (
              <Link
                className="advanced-unlock-primary-btn"
                href={`/courses/${selectedCourse}/quiz`}
              >
                <BookOpenCheck size={18} aria-hidden="true" />
                <span>Open {courses.find((c) => c.slug === selectedCourse)?.name} Advanced Practice</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : isValidCourse && commerceByCourse[selectedCourse].productSlug ? (
              <CheckoutButton
                className="advanced-unlock-primary-btn"
                label={`Unlock ${
                  courses.find((c) => c.slug === selectedCourse)?.name || selectedCourse
                } Advanced Practice`}
                productSlug={commerceByCourse[selectedCourse].productSlug}
              />
            ) : (
              <Link
                className="advanced-unlock-primary-btn"
                href={`/support?topic=advanced-practice${isValidCourse ? `&course=${selectedCourse}` : ""}`}
              >
                <MessageSquare size={18} aria-hidden="true" />
                <span>
                  {isValidCourse
                    ? `Unlock ${courses.find((c) => c.slug === selectedCourse)?.name} Advanced Practice`
                    : "Unlock Advanced Practice"}
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}

            <Link className="advanced-unlock-secondary-btn" href="/courses">
              <BookOpenCheck size={16} aria-hidden="true" />
              <span>Browse Standard Courses</span>
            </Link>
          </div>

          <div className="advanced-unlock-notes">
            <span>
              <CheckCircle2 size={13} color="#00a66d" aria-hidden="true" />
              Verified account activation by Aylem Learning
            </span>
            <span>
              <CheckCircle2 size={13} color="#00a66d" aria-hidden="true" />
              Continuous curriculum updates included
            </span>
            <span>
              <CheckCircle2 size={13} color="#00a66d" aria-hidden="true" />
              Available for IELTS, OET, PTE, and German
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
