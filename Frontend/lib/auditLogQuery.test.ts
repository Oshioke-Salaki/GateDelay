import { describe, expect, it } from "vitest";
import { buildMarketAuditSearchParams } from "./auditLogQuery";

describe("buildMarketAuditSearchParams", () => {
  it("maps event type, actor, market, and date range to backend query keys", () => {
    const params = buildMarketAuditSearchParams({
      operation: "CREATE_MARKET",
      actor: "admin-01",
      marketId: "market-100",
      from: "2026-06-01",
      to: "2026-06-30",
      limit: 50,
    });

    expect(params.get("operation")).toBe("CREATE_MARKET");
    expect(params.get("actor")).toBe("admin-01");
    expect(params.get("marketId")).toBe("market-100");
    expect(params.get("from")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(params.get("to")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(params.get("limit")).toBe("50");
  });

  it("omits sentinel and invalid identifiers so the backend DTO is not 400ed", () => {
    const params = buildMarketAuditSearchParams({
      operation: "all",
      actor: "all",
      marketId: "not a valid id",
    });

    expect(params.has("operation")).toBe(false);
    expect(params.has("actor")).toBe(false);
    expect(params.has("marketId")).toBe(false);
  });
});
