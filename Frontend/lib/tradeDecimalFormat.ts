export interface TradeDecimalFormatOptions {
  /** Maximum decimal places supported by the asset or API response. */
  precision?: number;
  /** Minimum fraction digits retained for familiar table formatting. */
  minimumFractionDigits?: number;
  locale?: string;
}

/**
 * Format a decimal string without converting its value to a JavaScript number.
 * Values below the selected precision are shown as less than one display unit
 * instead of being rounded to an apparent zero.
 */
export function formatTradeDecimal(
  value: string,
  {
    precision = 8,
    minimumFractionDigits = 0,
    locale,
  }: TradeDecimalFormatOptions = {},
): string {
  const raw = value.trim();
  const match = raw.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match || raw.length > 10_000) return value;

  const [, sign, wholePart, fractionPart = "", exponentPart = "0"] = match;
  const exponent = Number(exponentPart);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) return value;

  const digits = `${wholePart}${fractionPart}`;
  const point = wholePart.length + exponent;
  let whole: string;
  let fraction: string;
  if (point <= 0) {
    whole = "0";
    fraction = `${"0".repeat(-point)}${digits}`;
  } else if (point >= digits.length) {
    whole = `${digits}${"0".repeat(point - digits.length)}`;
    fraction = "";
  } else {
    whole = digits.slice(0, point);
    fraction = digits.slice(point);
  }

  const places = Number.isInteger(precision) ? Math.max(0, Math.min(100, precision)) : 8;
  const minimum = Number.isInteger(minimumFractionDigits)
    ? Math.max(0, Math.min(places, minimumFractionDigits))
    : 0;
  const scale = 10n ** BigInt(places);
  const keptFraction = fraction.slice(0, places).padEnd(places, "0");
  let scaled = BigInt(`${whole}${keptFraction}` || "0");
  if ((fraction[places] ?? "0") >= "5") scaled += 1n;

  const inputIsNonzero = /[1-9]/.test(digits);
  if (inputIsNonzero && scaled === 0n) {
    const threshold = places === 0 ? "1" : `0.${"0".repeat(places - 1)}1`;
    return `${sign === "-" ? "-" : ""}<${threshold}`;
  }

  const wholeValue = scaled / scale;
  const roundedFraction = places === 0
    ? ""
    : (scaled % scale).toString().padStart(places, "0");
  const trimmedFraction = roundedFraction.replace(/0+$/, "");
  const fractionDigits = Math.max(minimum, trimmedFraction.length);
  const formattedWhole = wholeValue.toLocaleString(locale);
  const formattedFraction = roundedFraction.slice(0, fractionDigits).padEnd(fractionDigits, "0");
  const decimalSeparator = locale
    ? new Intl.NumberFormat(locale)
        .formatToParts(1.1)
        .find((part) => part.type === "decimal")?.value ?? "."
    : ".";
  const formatted = fractionDigits > 0
    ? `${formattedWhole}${decimalSeparator}${formattedFraction}`
    : formattedWhole;

  return scaled === 0n ? formatted : `${sign === "-" ? "-" : ""}${formatted}`;
}
