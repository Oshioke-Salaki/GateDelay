/**
 * Bridge API client
 * Wraps all /api/bridge endpoints using the Fetch API (axios-compatible shape).
 * Switch the BASE_URL env var to point at your NestJS instance.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types (mirrors backend DTOs) ────────────────────────────────────────────

export type BridgeProtocol = "stargate" | "across" | "hop" | "cbridge" | "socket";

export type BridgeStatus =
  | "pending"
  | "approving"
  | "bridging"
  | "confirming"
  | "completed"
  | "failed"
  | "refunded";

export interface BridgeRouteQuote {
  protocol: BridgeProtocol;
  protocolName: string;
  estimatedTime: string;
  bridgeFee: string;
  feeBps: number;
  outputAmount: string;
  recommended: boolean;
  supported: boolean;
}

export interface BridgeTransaction {
  id: string;
  userId: string;
  protocol: BridgeProtocol;
  fromChainId: number;
  toChainId: number;
  fromChainName: string;
  toChainName: string;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  receivedAmount?: string;
  senderAddress: string;
  recipientAddress: string;
  status: BridgeStatus;
  sourceTxHash?: string;
  destinationTxHash?: string;
  bridgeTransferId?: string;
  sourceConfirmations: number;
  destinationConfirmations: number;
  bridgeFee: string;
  estimatedArrivalTime?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateBridgeParams {
  protocol: BridgeProtocol;
  fromChainId: number;
  toChainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  senderAddress: string;
  recipientAddress: string;
  slippageBps?: number;
  maxFeeUsd?: string;
}

export interface BridgeTransactionListParams {
  status?: BridgeStatus;
  protocol?: BridgeProtocol;
  fromChainId?: number;
  toChainId?: number;
  page?: number;
  limit?: number;
}

export interface BridgeAnalytics {
  totalTransactions: number;
  successRate: number;
  totalVolume: string;
  byProtocol: Array<{
    protocol: BridgeProtocol;
    count: number;
    volume: string;
    avgTimeSeconds: number;
  }>;
  byChainPair: Array<{
    fromChainId: number;
    toChainId: number;
    fromChainName: string;
    toChainName: string;
    count: number;
  }>;
  statusBreakdown: Record<BridgeStatus, number>;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Bridge API error ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? message;
    } catch {
      /* ignore parse failure */
    }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Fetch supported bridge protocols with fee/time config.
 */
export async function getBridgeProtocols(token: string) {
  return request<Array<{ protocol: BridgeProtocol; name: string; feeBps: number; avgTimeSeconds: number; supportedChainIds: number[] }>>(
    "/bridge/protocols",
    {},
    token,
  );
}

/**
 * Get route quotes from all protocols for a given transfer.
 */
export async function getBridgeRouteQuotes(
  params: { fromChainId: number; toChainId: number; tokenSymbol: string; amount: string },
  token: string,
): Promise<BridgeRouteQuote[]> {
  const qs = new URLSearchParams({
    fromChainId: String(params.fromChainId),
    toChainId: String(params.toChainId),
    tokenSymbol: params.tokenSymbol,
    amount: params.amount,
  });
  return request<BridgeRouteQuote[]>(`/bridge/quotes?${qs}`, {}, token);
}

/**
 * Initiate a new bridge transaction.
 */
export async function initiateBridgeTransaction(
  params: InitiateBridgeParams,
  token: string,
): Promise<BridgeTransaction> {
  return request<BridgeTransaction>(
    "/bridge/transactions",
    { method: "POST", body: JSON.stringify(params) },
    token,
  );
}

/**
 * List bridge transactions with optional filters.
 */
export async function getBridgeTransactions(
  params: BridgeTransactionListParams = {},
  token: string,
): Promise<{ transactions: BridgeTransaction[]; total: number; page: number; totalPages: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.protocol) qs.set("protocol", params.protocol);
  if (params.fromChainId) qs.set("fromChainId", String(params.fromChainId));
  if (params.toChainId) qs.set("toChainId", String(params.toChainId));
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  return request(`/bridge/transactions${query}`, {}, token);
}

/**
 * Fetch a single bridge transaction by ID.
 */
export async function getBridgeTransaction(id: string, token: string): Promise<BridgeTransaction> {
  return request<BridgeTransaction>(`/bridge/transactions/${id}`, {}, token);
}

/**
 * Look up a bridge transaction by source chain tx hash.
 */
export async function getBridgeTransactionByHash(
  sourceTxHash: string,
  token: string,
): Promise<BridgeTransaction> {
  return request<BridgeTransaction>(`/bridge/transactions/hash/${sourceTxHash}`, {}, token);
}

/**
 * Update status / hashes / confirmations on a bridge transaction.
 */
export async function updateBridgeTransaction(
  id: string,
  update: Partial<Pick<BridgeTransaction, "status" | "sourceTxHash" | "destinationTxHash" | "sourceConfirmations" | "destinationConfirmations" | "receivedAmount" | "errorMessage">>,
  token: string,
): Promise<BridgeTransaction> {
  return request<BridgeTransaction>(
    `/bridge/transactions/${id}`,
    { method: "PATCH", body: JSON.stringify(update) },
    token,
  );
}

/**
 * Fetch bridge analytics (volume, success rate, protocol breakdown).
 */
export async function getBridgeAnalytics(token: string, userId?: string): Promise<BridgeAnalytics> {
  const qs = userId ? `?userId=${userId}` : "";
  return request<BridgeAnalytics>(`/bridge/analytics${qs}`, {}, token);
}

/**
 * Get transactions that have passed their estimated arrival time.
 */
export async function getStaleTransactions(token: string): Promise<BridgeTransaction[]> {
  return request<BridgeTransaction[]>("/bridge/transactions/stale", {}, token);
}
