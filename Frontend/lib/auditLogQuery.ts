import { endOfDay, parseISO, startOfDay } from "date-fns";

/**
 * Query keys forwarded by `GET /api/market-audit` to
 * `GET ${API}/market-audit/logs` (`AuditQueryDto`).
 */
export const MARKET_AUDIT_QUERY_KEYS = [
  "marketId",
  "operation",
  "actor",
  "from",
  "to",
  "limit",
  "page",
] as const;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const OPERATION_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export interface AuditLogFilters {
  /** Event type — backend field `operation`. */
  operation?: string;
  actor?: string;
  marketId?: string;
  /** Date input value `yyyy-MM-dd`. */
  from?: string;
  /** Date input value `yyyy-MM-dd`. */
  to?: string;
  limit?: number;
}

function isSentinel(value: string | undefined): boolean {
  return !value || value === "all";
}

export function toAuditIsoRangeStart(dateInput: string): string | null {
  try {
    return startOfDay(parseISO(dateInput)).toISOString();
  } catch {
    return null;
  }
}

export function toAuditIsoRangeEnd(dateInput: string): string | null {
  try {
    return endOfDay(parseISO(dateInput)).toISOString();
  } catch {
    return null;
  }
}

export function buildMarketAuditSearchParams(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set("limit", String(filters.limit ?? 1000));

  if (!isSentinel(filters.operation) && OPERATION_PATTERN.test(filters.operation!)) {
    params.set("operation", filters.operation!);
  }
  if (!isSentinel(filters.actor) && IDENTIFIER_PATTERN.test(filters.actor!)) {
    params.set("actor", filters.actor!);
  }
  const marketId = filters.marketId?.trim();
  if (marketId && marketId !== "all" && IDENTIFIER_PATTERN.test(marketId)) {
    params.set("marketId", marketId);
  }
  if (filters.from) {
    const from = toAuditIsoRangeStart(filters.from);
    if (from) params.set("from", from);
  }
  if (filters.to) {
    const to = toAuditIsoRangeEnd(filters.to);
    if (to) params.set("to", to);
  }

  return params;
}
