import { describe, expect, it } from "vitest";

import { majorToMinor, minorToMajor, normalizeCashfreeStatus } from "./cashfree";
import { ADVANCED_PRICE_AMOUNT_MINOR, ADVANCED_PRICE_CURRENCY, formatMoneyMinor } from "./service";

describe("Cashfree helpers and 299 Pricing", () => {
  it("converts money without floating-point storage", () => {
    expect(minorToMajor(29900)).toBe(299);
    expect(majorToMinor(299.00)).toBe(29900);
  });

  it("strictly defines the Advanced section price as 299 INR", () => {
    expect(ADVANCED_PRICE_AMOUNT_MINOR).toBe(29900);
    expect(ADVANCED_PRICE_CURRENCY).toBe("INR");
    expect(formatMoneyMinor(ADVANCED_PRICE_AMOUNT_MINOR, ADVANCED_PRICE_CURRENCY)).toContain("299");
    expect(formatMoneyMinor(ADVANCED_PRICE_AMOUNT_MINOR, ADVANCED_PRICE_CURRENCY)).toContain("₹");
  });

  it("normalizes known payment states and safely handles unknown states", () => {
    expect(normalizeCashfreeStatus("SUCCESS")).toBe("SUCCESS");
    expect(normalizeCashfreeStatus("FAILED")).toBe("FAILED");
    expect(normalizeCashfreeStatus("USER_DROPPED")).toBe("USER_DROPPED");
    expect(normalizeCashfreeStatus("REFUND_INITIATED")).toBe("UNKNOWN");
  });
});

