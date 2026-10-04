import { describe, expect, it } from "vitest";

import { majorToMinor, minorToMajor, normalizeCashfreeStatus } from "./cashfree";

describe("Cashfree helpers", () => {
  it("converts money without floating-point storage", () => {
    expect(minorToMajor(24900)).toBe(249);
    expect(majorToMinor(249.01)).toBe(24901);
  });

  it("normalizes known payment states and safely handles unknown states", () => {
    expect(normalizeCashfreeStatus("SUCCESS")).toBe("SUCCESS");
    expect(normalizeCashfreeStatus("FAILED")).toBe("FAILED");
    expect(normalizeCashfreeStatus("USER_DROPPED")).toBe("USER_DROPPED");
    expect(normalizeCashfreeStatus("REFUND_INITIATED")).toBe("UNKNOWN");
  });
});
