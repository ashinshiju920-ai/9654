import { describe, expect, it } from "vitest";

import {
  entitlementTierAllows,
  isAccessTier,
  isEntitlementActive,
  type EntitlementRecord,
} from "./entitlements";

const baseEntitlement: EntitlementRecord = {
  id: "ent-1",
  userId: "user-1",
  courseId: "course-1",
  accessTier: "STANDARD",
  status: "ACTIVE",
  source: "ADMIN",
  grantedAt: new Date("2026-01-01T00:00:00Z"),
  expiresAt: null,
  externalReference: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("Entitlement policy", () => {
  it("validates supported access tiers", () => {
    expect(isAccessTier("STANDARD")).toBe(true);
    expect(isAccessTier("ADVANCED")).toBe(true);
    expect(isAccessTier("PREMIUM")).toBe(false);
  });

  it("treats lifetime active entitlements as valid", () => {
    expect(isEntitlementActive(baseEntitlement, new Date("2026-02-01T00:00:00Z"))).toBe(true);
  });

  it("denies revoked entitlements", () => {
    expect(
      isEntitlementActive(
        { ...baseEntitlement, status: "REVOKED" },
        new Date("2026-02-01T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("denies expired entitlements even when status is still ACTIVE", () => {
    expect(
      isEntitlementActive(
        { ...baseEntitlement, expiresAt: new Date("2026-01-01T00:00:00Z") },
        new Date("2026-02-01T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("allows unexpired entitlements", () => {
    expect(
      isEntitlementActive(
        { ...baseEntitlement, expiresAt: new Date("2026-03-01T00:00:00Z") },
        new Date("2026-02-01T00:00:00Z"),
      ),
    ).toBe(true);
  });

  it("does not let Standard grant Advanced access", () => {
    expect(entitlementTierAllows("STANDARD", "ADVANCED")).toBe(false);
  });

  it("lets Advanced grant same-course Standard access centrally", () => {
    expect(entitlementTierAllows("ADVANCED", "STANDARD")).toBe(true);
  });
}
);
