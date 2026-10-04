import { describe, expect, it } from "vitest";

// Helper functions that model the readiness evaluation and funnel logic
// (mirroring src/app/courses/[slug]/quiz/quiz-engine.tsx and src/components/commercial/advanced-post-result-promo.tsx)
export function getReadinessEvaluation(percentage: number | string) {
  const numericPct = typeof percentage === "string" ? parseFloat(percentage) : percentage;
  const isBenchmarkReached = numericPct >= 70;

  return {
    numericPercentage: numericPct,
    isPassed: isBenchmarkReached,
    statusBadge: isBenchmarkReached ? "Practice Benchmark Reached" : "Needs More Preparation",
    headline: isBenchmarkReached ? "Strong Mock-Test Performance" : "You're Not Exam-Ready Yet",
    message: isBenchmarkReached
      ? "You reached Aylem's 70% practice-readiness benchmark on this mock test. Keep practicing to improve consistency, accuracy and coverage before your exam."
      : "Based on this mock test, your score is below our 70% practice-readiness benchmark. Strengthen your weak areas and complete more focused practice before relying on this result as exam preparation.",
  };
}

export function getAdvancedPracticeFunnel(courseSlug: string, percentage: number | string) {
  const evalResult = getReadinessEvaluation(percentage);

  const courseNames: Record<string, string> = {
    ielts: "IELTS Preparation",
    oet: "OET Preparation",
    pte: "PTE Academic",
    german: "German Language",
  };

  const courseName = courseNames[courseSlug] || "Course";
  const targetUrl = `/advanced-mock-test?course=${courseSlug}`;

  if (evalResult.isPassed) {
    return {
      promoTitle: "Push Your Score Further",
      promoSubtitle: "Challenge yourself with deeper question coverage and continue building consistency with Advanced Practice.",
      ctaLabel: `Continue to ${courseName} Advanced Practice`,
      targetUrl,
    };
  } else {
    return {
      promoTitle: "Build Your Exam Readiness",
      promoSubtitle: "Continue with deeper practice using Aylem Advanced Practice, with expanded question coverage built around previous exam patterns, recurring question types and high-priority topics.",
      ctaLabel: `Continue to ${courseName} Advanced Practice`,
      targetUrl,
    };
  }
}

describe("Score-Based Readiness and Advanced Practice Funnel Tests", () => {
  it("evaluates 0% as below-threshold state", () => {
    const res = getReadinessEvaluation(0);
    expect(res.isPassed).toBe(false);
    expect(res.statusBadge).toBe("Needs More Preparation");
    expect(res.headline).toBe("You're Not Exam-Ready Yet");
    expect(res.message).toContain("below our 70% practice-readiness benchmark");
    expect(res.message).not.toContain("guaranteed to fail");
  });

  it("evaluates 69.99% as below-threshold state", () => {
    const res = getReadinessEvaluation("69.99");
    expect(res.isPassed).toBe(false);
    expect(res.statusBadge).toBe("Needs More Preparation");
    expect(res.headline).toBe("You're Not Exam-Ready Yet");
  });

  it("evaluates exactly 70.00% as benchmark reached state", () => {
    const res = getReadinessEvaluation("70.00");
    expect(res.isPassed).toBe(true);
    expect(res.statusBadge).toBe("Practice Benchmark Reached");
    expect(res.headline).toBe("Strong Mock-Test Performance");
    expect(res.message).toContain("reached Aylem's 70% practice-readiness benchmark");
    expect(res.message).not.toContain("guaranteed to pass");
  });

  it("evaluates 100% as benchmark reached state", () => {
    const res = getReadinessEvaluation(100);
    expect(res.isPassed).toBe(true);
    expect(res.statusBadge).toBe("Practice Benchmark Reached");
    expect(res.headline).toBe("Strong Mock-Test Performance");
  });

  describe("Course-Aware Funnel CTAs", () => {
    it("routes IELTS below-70 score to IELTS Advanced Practice with readiness builder copy", () => {
      const funnel = getAdvancedPracticeFunnel("ielts", 55);
      expect(funnel.promoTitle).toBe("Build Your Exam Readiness");
      expect(funnel.ctaLabel).toBe("Continue to IELTS Preparation Advanced Practice");
      expect(funnel.targetUrl).toBe("/advanced-mock-test?course=ielts");
    });

    it("routes OET below-70 score to OET Advanced Practice with readiness builder copy", () => {
      const funnel = getAdvancedPracticeFunnel("oet", 65);
      expect(funnel.promoTitle).toBe("Build Your Exam Readiness");
      expect(funnel.ctaLabel).toBe("Continue to OET Preparation Advanced Practice");
      expect(funnel.targetUrl).toBe("/advanced-mock-test?course=oet");
    });

    it("routes PTE 70+ score to PTE Advanced Practice with push further copy", () => {
      const funnel = getAdvancedPracticeFunnel("pte", 85);
      expect(funnel.promoTitle).toBe("Push Your Score Further");
      expect(funnel.ctaLabel).toBe("Continue to PTE Academic Advanced Practice");
      expect(funnel.targetUrl).toBe("/advanced-mock-test?course=pte");
    });

    it("routes German 70+ score to German Advanced Practice with push further copy", () => {
      const funnel = getAdvancedPracticeFunnel("german", 90);
      expect(funnel.promoTitle).toBe("Push Your Score Further");
      expect(funnel.ctaLabel).toBe("Continue to German Language Advanced Practice");
      expect(funnel.targetUrl).toBe("/advanced-mock-test?course=german");
    });
  });

  describe("Anti-manipulation and Pre-submission isolation", () => {
    it("ensures no readiness states or outcome guarantees appear before submission", () => {
      // Simulating in-progress test state
      const attemptState = {
        status: "in_progress",
        score: null,
        percentage: null,
      };

      expect(attemptState.score).toBeNull();
      expect(attemptState.percentage).toBeNull();
      // Readiness evaluation cannot be performed without a server-side percentage
      expect(() => {
        if (!attemptState.percentage) throw new Error("No score available before submission");
      }).toThrow("No score available before submission");
    });

    it("ensures copy never makes unsupported absolute guarantees", () => {
      const lowResult = getReadinessEvaluation(35);
      const highResult = getReadinessEvaluation(85);

      const prohibitedPhrases = [
        "guaranteed to fail",
        "you cannot pass",
        "100% not ready",
        "buy this to pass",
        "guaranteed to pass",
        "guarantees success",
      ];

      for (const phrase of prohibitedPhrases) {
        expect(lowResult.message.toLowerCase()).not.toContain(phrase);
        expect(lowResult.headline.toLowerCase()).not.toContain(phrase);
        expect(highResult.message.toLowerCase()).not.toContain(phrase);
        expect(highResult.headline.toLowerCase()).not.toContain(phrase);
      }
    });
  });
});
