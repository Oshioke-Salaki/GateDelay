export type MarketOutcome = "YES" | "NO" | "yes" | "no" | "cancelled" | "canceled";
export type OrderState =
  | "pending"
  | "validating"
  | "executing"
  | "completed"
  | "failed"
  | "rejected"
  | "filled"
  | "cancelled"
  | "canceled"
  | "open";

export const MARKET_OUTCOME_LABELS = {
  YES: "Yes",
  NO: "No",
  yes: "Yes",
  no: "No",
  cancelled: "Cancelled",
  canceled: "Cancelled",
} as const satisfies Record<MarketOutcome, string>;

export const ORDER_STATE_LABELS = {
  open: "Open",
  pending: "Pending",
  validating: "Validating",
  executing: "Executing",
  filled: "Filled",
  completed: "Completed",
  failed: "Failed",
  rejected: "Rejected",
  cancelled: "Cancelled",
  canceled: "Cancelled",
} as const satisfies Record<OrderState, string>;

export function getMarketOutcomeLabel(outcome: MarketOutcome): string {
  return MARKET_OUTCOME_LABELS[outcome] ?? String(outcome);
}

export function getOrderStateLabel(state: OrderState): string {
  return ORDER_STATE_LABELS[state] ?? String(state);
}
