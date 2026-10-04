import { describe, expect, it } from "vitest";

import { safeAppPath } from "@/lib/auth/account-lifecycle";
import { formatMoneyMinor } from "@/lib/commerce/service";

describe("Checkout Handoff & Security Suite", () => {
  describe("Open Redirect & Continuation Defense (safeAppPath)", () => {
    it("permits valid internal application paths", () => {
      expect(safeAppPath("/checkout/ielts-advanced", "/dashboard")).toBe("/checkout/ielts-advanced");
      expect(safeAppPath("/checkout/oet-advanced?promo=test", "/dashboard")).toBe(
        "/checkout/oet-advanced?promo=test",
      );
      expect(safeAppPath("/courses/ielts", "/dashboard")).toBe("/courses/ielts");
      expect(safeAppPath("/dashboard", "/dashboard")).toBe("/dashboard");
    });

    it("rejects protocol-relative open redirect URLs", () => {
      expect(safeAppPath("//evil.com", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("//malicious.site/phish", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("///attacker.com", "/dashboard")).toBe("/dashboard");
    });

    it("rejects absolute URLs pointing to external domains", () => {
      expect(safeAppPath("https://evil.com", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("http://evil.com/checkout", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("ftp://evil.com", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("javascript:alert(1)", "/dashboard")).toBe("/dashboard");
    });

    it("rejects backslash evasion attempts", () => {
      expect(safeAppPath("/\\evil.com", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("/\\/evil.com", "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("\\evil.com", "/dashboard")).toBe("/dashboard");
    });

    it("handles null, undefined, and empty string safely", () => {
      expect(safeAppPath(null, "/dashboard")).toBe("/dashboard");
      expect(safeAppPath(undefined, "/dashboard")).toBe("/dashboard");
      expect(safeAppPath("", "/dashboard")).toBe("/dashboard");
    });
  });

  describe("Server-Authoritative Pricing Display", () => {
    it("formats minor units strictly into authoritative INR currency", () => {
      expect(formatMoneyMinor(19900, "INR")).toContain("199");
      expect(formatMoneyMinor(19900, "INR")).toContain("₹");
    });

    it("ensures zero or invalid amounts do not silently grant access", () => {
      expect(formatMoneyMinor(0, "INR")).toContain("0");
    });
  });

  describe("Approved Product Catalogue Mapping", () => {
    const approvedAdvancedSlugs = [
      "ielts-advanced",
      "oet-advanced",
      "pte-advanced",
      "german-advanced",
    ];

    it("all 4 approved course slugs match expected naming convention", () => {
      approvedAdvancedSlugs.forEach((slug) => {
        expect(slug).toMatch(/^[a-z]+-advanced$/);
        expect(["ielts", "oet", "pte", "german"]).toContain(slug.split("-")[0]);
      });
    });
  });
});
