/**
 * Unit tests for Frontend/lib/bridgeApi.ts
 *
 * Coverage:
 *  - BASE_URL construction from NEXT_PUBLIC_API_URL
 *  - bridgeContractAddress helper
 *  - request() error parsing (non-ok responses with JSON body and without)
 *  - getBridgeProtocols, getBridgeRouteQuotes, initiateBridgeTransaction,
 *    getBridgeTransactions, getBridgeTransaction, updateBridgeTransaction,
 *    getBridgeAnalytics, getStaleTransactions, getBridgeTransactionByHash
 *
 * Issue: #892
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BridgeTransaction, BridgeRouteQuote, BridgeAnalytics } from "./bridgeApi";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal BridgeTransaction fixture. */
function makeTx(overrides: Partial<BridgeTransaction> = {}): BridgeTransaction {
  return {
    id: "tx-1",
    userId: "user-1",
    protocol: "stargate",
    fromChainId: 1,
    toChainId: 137,
    fromChainName: "Ethereum",
    toChainName: "Polygon",
    tokenSymbol: "USDC",
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    amount: "1000000",
    senderAddress: "0x1111111111111111111111111111111111111111",
    recipientAddress: "0x2222222222222222222222222222222222222222",
    status: "pending",
    sourceConfirmations: 0,
    destinationConfirmations: 0,
    bridgeFee: "500",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Stub global.fetch to return a resolved response. */
function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

/** Stub global.fetch to return a non-ok response whose body is not valid JSON. */
function mockFetchBadJson(status: number): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    }),
  );
}

// ─── suite setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ─────────────────────────────────────────────────────────────────────────────
// BASE_URL construction
// ─────────────────────────────────────────────────────────────────────────────

describe("BASE_URL — NEXT_PUBLIC_API_URL env variable", () => {
  it("uses NEXT_PUBLIC_API_URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com/api");
    mockFetch([]);
    const { getBridgeProtocols } = await import("./bridgeApi");
    await getBridgeProtocols("tok");

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toMatch(/^https:\/\/api\.example\.com\/api/);
  });

  it("falls back to http://localhost:3000/api when NEXT_PUBLIC_API_URL is unset", async () => {
    // bridgeApi.ts uses `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"`.
    // The ?? operator only triggers for null/undefined, not for an empty string.
    // Delete the variable so the nullish fallback activates.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined as unknown as string);
    mockFetch([]);
    const { getBridgeProtocols } = await import("./bridgeApi");
    await getBridgeProtocols("tok");

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    // When the env var is absent the module falls back to "http://localhost:3000/api"
    // so the full URL should start with that base.
    expect(url).toMatch(/^http:\/\/localhost:3000\/api/);
  });

  it("requests the /bridge/protocols path", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://backend.test/api");
    mockFetch([]);
    const { getBridgeProtocols } = await import("./bridgeApi");
    await getBridgeProtocols("tok");

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("https://backend.test/api/bridge/protocols");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// bridgeContractAddress helper
// ─────────────────────────────────────────────────────────────────────────────

describe("bridgeContractAddress", () => {
  it("returns undefined when NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", "");
    const { bridgeContractAddress } = await import("./bridgeApi");
    expect(bridgeContractAddress()).toBeUndefined();
  });

  it("returns the MarketBridge address from a valid registry", async () => {
    const registry = JSON.stringify({
      contracts: [
        {
          name: "MarketBridge",
          address: "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01",
          chainId: 1,
          abiVersion: "v1",
        },
      ],
    });
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", registry);
    const { bridgeContractAddress } = await import("./bridgeApi");
    expect(bridgeContractAddress()).toBe("0xAbCdEf0123456789AbCdEf0123456789AbCdEf01");
  });

  it("returns undefined when MarketBridge is not in the registry", async () => {
    const registry = JSON.stringify({
      contracts: [
        {
          name: "Trading",
          address: "0x1111111111111111111111111111111111111111",
          chainId: 1,
          abiVersion: "v1",
        },
      ],
    });
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", registry);
    const { bridgeContractAddress } = await import("./bridgeApi");
    expect(bridgeContractAddress()).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error response parsing
// ─────────────────────────────────────────────────────────────────────────────

describe("request() — error response parsing", () => {
  it("throws with the API message when the response body contains a message field", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({ message: "Protocol not supported" }, 400);
    const { getBridgeProtocols } = await import("./bridgeApi");

    await expect(getBridgeProtocols("tok")).rejects.toThrow("Protocol not supported");
  });

  it("throws a generic message when the error body has no message field", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({ error: "bad request" }, 400);
    const { getBridgeProtocols } = await import("./bridgeApi");

    await expect(getBridgeProtocols("tok")).rejects.toThrow("Bridge API error 400");
  });

  it("throws a generic message when the error body is not valid JSON", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetchBadJson(500);
    const { getBridgeProtocols } = await import("./bridgeApi");

    await expect(getBridgeProtocols("tok")).rejects.toThrow("Bridge API error 500");
  });

  it("throws a 401 generic message for unauthorised responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({ message: "Unauthorized" }, 401);
    const { getBridgeProtocols } = await import("./bridgeApi");

    await expect(getBridgeProtocols("tok")).rejects.toThrow("Unauthorized");
  });

  it("throws a 404 generic message when the resource is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({ message: "Transaction not found" }, 404);
    const { getBridgeTransaction } = await import("./bridgeApi");

    await expect(getBridgeTransaction("bad-id", "tok")).rejects.toThrow(
      "Transaction not found",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authorization header
// ─────────────────────────────────────────────────────────────────────────────

describe("request() — Authorization header", () => {
  it("sends Bearer token in Authorization header", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch([]);
    const { getBridgeProtocols } = await import("./bridgeApi");
    await getBridgeProtocols("my-token");

    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(init.headers["Authorization"]).toBe("Bearer my-token");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBridgeRouteQuotes
// ─────────────────────────────────────────────────────────────────────────────

describe("getBridgeRouteQuotes", () => {
  it("encodes query parameters correctly", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const quotes: BridgeRouteQuote[] = [];
    mockFetch(quotes);
    const { getBridgeRouteQuotes } = await import("./bridgeApi");

    await getBridgeRouteQuotes(
      { fromChainId: 1, toChainId: 137, tokenSymbol: "USDC", amount: "1000000" },
      "tok",
    );

    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("fromChainId=1");
    expect(url).toContain("toChainId=137");
    expect(url).toContain("tokenSymbol=USDC");
    expect(url).toContain("amount=1000000");
  });

  it("returns the parsed quotes array", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const quotes: BridgeRouteQuote[] = [
      {
        protocol: "stargate",
        protocolName: "Stargate",
        estimatedTime: "5 min",
        bridgeFee: "100",
        feeBps: 10,
        outputAmount: "999900",
        recommended: true,
        supported: true,
      },
    ];
    mockFetch(quotes);
    const { getBridgeRouteQuotes } = await import("./bridgeApi");

    const result = await getBridgeRouteQuotes(
      { fromChainId: 1, toChainId: 137, tokenSymbol: "USDC", amount: "1000000" },
      "tok",
    );
    expect(result).toHaveLength(1);
    expect(result[0].protocol).toBe("stargate");
    expect(result[0].recommended).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// initiateBridgeTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe("initiateBridgeTransaction", () => {
  it("POSTs to /bridge/transactions with the correct body", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const tx = makeTx({ status: "pending" });
    mockFetch(tx);
    const { initiateBridgeTransaction } = await import("./bridgeApi");

    const params = {
      protocol: "stargate" as const,
      fromChainId: 1,
      toChainId: 137,
      tokenSymbol: "USDC",
      tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      amount: "1000000",
      senderAddress: "0x1111111111111111111111111111111111111111",
      recipientAddress: "0x2222222222222222222222222222222222222222",
    };

    const result = await initiateBridgeTransaction(params, "tok");

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://localhost:3000/api/bridge/transactions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ protocol: "stargate", fromChainId: 1 });
    expect(result.id).toBe("tx-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBridgeTransactions — optional filters
// ─────────────────────────────────────────────────────────────────────────────

describe("getBridgeTransactions", () => {
  it("fetches without query string when no filters are supplied", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({ transactions: [], total: 0, page: 1, totalPages: 0 });
    const { getBridgeTransactions } = await import("./bridgeApi");

    await getBridgeTransactions({}, "tok");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("http://localhost:3000/api/bridge/transactions");
  });

  it("appends supported filter params to the query string", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({ transactions: [], total: 0, page: 1, totalPages: 0 });
    const { getBridgeTransactions } = await import("./bridgeApi");

    await getBridgeTransactions({ status: "completed", page: 2, limit: 10 }, "tok");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("status=completed");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
  });

  it("returns the paginated response shape", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const tx = makeTx({ status: "completed" });
    mockFetch({ transactions: [tx], total: 1, page: 1, totalPages: 1 });
    const { getBridgeTransactions } = await import("./bridgeApi");

    const result = await getBridgeTransactions({}, "tok");
    expect(result.total).toBe(1);
    expect(result.transactions[0].status).toBe("completed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBridgeTransaction (single)
// ─────────────────────────────────────────────────────────────────────────────

describe("getBridgeTransaction", () => {
  it("requests /bridge/transactions/:id", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch(makeTx({ id: "abc-123" }));
    const { getBridgeTransaction } = await import("./bridgeApi");

    const result = await getBridgeTransaction("abc-123", "tok");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("http://localhost:3000/api/bridge/transactions/abc-123");
    expect(result.id).toBe("abc-123");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBridgeTransactionByHash
// ─────────────────────────────────────────────────────────────────────────────

describe("getBridgeTransactionByHash", () => {
  it("requests /bridge/transactions/hash/:hash", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const txHash = "0xdeadbeef";
    mockFetch(makeTx({ sourceTxHash: txHash }));
    const { getBridgeTransactionByHash } = await import("./bridgeApi");

    await getBridgeTransactionByHash(txHash, "tok");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe(`http://localhost:3000/api/bridge/transactions/hash/${txHash}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateBridgeTransaction
// ─────────────────────────────────────────────────────────────────────────────

describe("updateBridgeTransaction", () => {
  it("sends PATCH to /bridge/transactions/:id with partial update", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const updated = makeTx({ id: "tx-5", status: "completed" });
    mockFetch(updated);
    const { updateBridgeTransaction } = await import("./bridgeApi");

    const result = await updateBridgeTransaction(
      "tx-5",
      { status: "completed", destinationTxHash: "0xfeed" },
      "tok",
    );

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://localhost:3000/api/bridge/transactions/tx-5");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toMatchObject({
      status: "completed",
      destinationTxHash: "0xfeed",
    });
    expect(result.status).toBe("completed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getBridgeAnalytics
// ─────────────────────────────────────────────────────────────────────────────

describe("getBridgeAnalytics", () => {
  it("requests /bridge/analytics without userId when not provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const analytics: BridgeAnalytics = {
      totalTransactions: 5,
      successRate: 0.8,
      totalVolume: "5000000",
      byProtocol: [],
      byChainPair: [],
      statusBreakdown: {
        pending: 1,
        approving: 0,
        bridging: 0,
        confirming: 0,
        completed: 4,
        failed: 0,
        refunded: 0,
      },
    };
    mockFetch(analytics);
    const { getBridgeAnalytics } = await import("./bridgeApi");

    const result = await getBridgeAnalytics("tok");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("http://localhost:3000/api/bridge/analytics");
    expect(result.totalTransactions).toBe(5);
  });

  it("appends userId as a query param when provided", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    mockFetch({
      totalTransactions: 0,
      successRate: 0,
      totalVolume: "0",
      byProtocol: [],
      byChainPair: [],
      statusBreakdown: {
        pending: 0,
        approving: 0,
        bridging: 0,
        confirming: 0,
        completed: 0,
        failed: 0,
        refunded: 0,
      },
    });
    const { getBridgeAnalytics } = await import("./bridgeApi");

    await getBridgeAnalytics("tok", "user-42");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain("userId=user-42");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStaleTransactions
// ─────────────────────────────────────────────────────────────────────────────

describe("getStaleTransactions", () => {
  it("requests /bridge/transactions/stale", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3000/api");
    const stale = [makeTx({ status: "bridging" })];
    mockFetch(stale);
    const { getStaleTransactions } = await import("./bridgeApi");

    const result = await getStaleTransactions("tok");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, ...unknown[]];
    expect(url).toBe("http://localhost:3000/api/bridge/transactions/stale");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("bridging");
  });
});
