const DEFAULT_LOCALE = "en-US";

export function formatOdds(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 0.1 ? 1 : 0,
  }).format(value);
}

export function formatPercentage(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatTokenAmount(value: number | null | undefined, token = "", locale = DEFAULT_LOCALE): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return token ? `N/A ${token}` : "N/A";

  const amount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: value === 0 ? 0 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);

  return token ? `${amount} ${token}` : amount;
}

export function formatLiquidity(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  return formatCompactCurrency(value, locale);
}

export function formatVolume(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  return formatCompactCurrency(value, locale);
}

export function formatCurrency(value: number | null | undefined, locale = DEFAULT_LOCALE): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactCurrency(value: number | null | undefined, locale: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10_000 ? 1 : 0,
  }).format(value);
}
