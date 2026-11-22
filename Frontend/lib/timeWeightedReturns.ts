export interface CashFlow { timestamp: number; amount: number }
/** Values are total account equity AFTER any external flows at that timestamp. */
export interface PortfolioValue { timestamp: number; value: number }

/** Exact linked subperiod returns require a valuation at every external flow. */
export function calculateTWR(values: PortfolioValue[], cashFlows: CashFlow[]): number | null {
  if (values.length < 2) return null;
  if (values.some((v) => !Number.isFinite(v.timestamp) || !Number.isFinite(v.value) || v.value < 0) || cashFlows.some((f) => !Number.isFinite(f.timestamp) || !Number.isFinite(f.amount))) return null;
  const sorted = [...values].sort((a, b) => a.timestamp - b.timestamp);
  if (sorted.some((v, i) => i > 0 && v.timestamp === sorted[i - 1].timestamp)) return null;
  const first = sorted[0].timestamp;
  const last = sorted[sorted.length - 1].timestamp;
  const flows = new Map<number, number>();
  for (const flow of cashFlows) {
    // The opening valuation already includes opening flows.
    if (flow.timestamp <= first || flow.timestamp > last) continue;
    if (!sorted.some((v) => v.timestamp === flow.timestamp)) return null;
    flows.set(flow.timestamp, (flows.get(flow.timestamp) ?? 0) + flow.amount);
  }
  let growth = 1;
  for (let i = 1; i < sorted.length; i++) {
    const start = sorted[i - 1].value;
    const beforeFlow = sorted[i].value - (flows.get(sorted[i].timestamp) ?? 0);
    if (start <= 0 || beforeFlow < 0) return null;
    growth *= beforeFlow / start;
    if (!Number.isFinite(growth)) return null;
  }
  return (growth - 1) * 100;
}
