import { describe, expect, it } from "vitest";
import { formatTradeDecimal } from "./tradeDecimalFormat";

describe("formatTradeDecimal", () => {
  it("keeps large integer and fractional digits exact", () => {
    expect(
      formatTradeDecimal("9007199254740993.125", {
        precision: 4,
        minimumFractionDigits: 4,
      }),
    ).toBe("9,007,199,254,740,993.1250");
  });

  it("shows a nonzero amount below token precision as less than one unit", () => {
    expect(
      formatTradeDecimal("0.000049", {
        precision: 4,
        minimumFractionDigits: 4,
      }),
    ).toBe("<0.0001");
  });

  it("preserves the sign when a tiny negative value is below display precision", () => {
    expect(
      formatTradeDecimal("-0.000049", {
        precision: 4,
        minimumFractionDigits: 4,
      }),
    ).toBe("-<0.0001");
  });

  it("rounds at the supplied precision without binary floating point", () => {
    expect(
      formatTradeDecimal("0.00005", {
        precision: 4,
        minimumFractionDigits: 4,
      }),
    ).toBe("0.0001");
  });

  it("formats values beyond Number.MAX_SAFE_INTEGER without losing digits", () => {
    expect(
      formatTradeDecimal("12345678901234567890.123456789", {
        precision: 8,
        minimumFractionDigits: 2,
      }),
    ).toBe("12,345,678,901,234,567,890.12345679");
  });

  it("accepts decimal strings in exponent notation", () => {
    expect(formatTradeDecimal("1.25e-5", { precision: 8 })).toBe("0.0000125");
  });

  it("uses the locale decimal separator", () => {
    expect(
      formatTradeDecimal("1234.5", {
        precision: 2,
        minimumFractionDigits: 2,
        locale: "de-DE",
      }),
    ).toBe("1.234,50");
  });
});
