import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/settlement/preview", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://backend.test/api");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a projection for the selected outcome, not a finalized result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "confirmed" }),
      }),
    );

    const res = await GET(
      new Request(
        "http://localhost/api/settlement/preview?marketId=m1&outcome=YES&status=active&totalYesStake=40&totalNoStake=10",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("projection");
    expect(body.projectedWinningOutcome).toBe("YES");
    expect(body.projectedPayoutEffect).toMatch(/not a finalized settlement/i);
    expect(body.marketStatus).toBe("confirmed");
    expect(body.source).toBe("backend");
  });

  it("updates the projected winner when the resolution changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    const yes = await (
      await GET(
        new Request(
          "http://localhost/api/settlement/preview?marketId=m1&outcome=YES&status=open&totalYesStake=5&totalNoStake=5",
        ),
      )
    ).json();
    const no = await (
      await GET(
        new Request(
          "http://localhost/api/settlement/preview?marketId=m1&outcome=NO&status=open&totalYesStake=5&totalNoStake=5",
        ),
      )
    ).json();

    expect(yes.projectedWinningOutcome).toBe("YES");
    expect(no.projectedWinningOutcome).toBe("NO");
    expect(no.projectedPayoutEffect).toMatch(/NO wins/);
  });

  it("handles missing stake data without throwing", async () => {
    const res = await GET(
      new Request("http://localhost/api/settlement/preview?marketId=m1&outcome=YES&status=open"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.available).toBe(false);
    expect(body.projectedPayoutEffect).toMatch(/unavailable/i);
  });
});
