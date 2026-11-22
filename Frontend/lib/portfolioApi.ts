import { decodeEventLog, parseAbi, type Hex } from "viem";
import { parseDeploymentRegistry } from "./deploymentRegistry";
import { resolveApiBase } from "./apiBase";

export interface AccountPosition {
  id: string;
  account: string;
  chainId: string;
  marketId: string;
  side: "YES" | "NO";
  shares: number;
  sharesExact: string;
  entryPrice: number;
  currentPrice: number;
  costBasis: number;
  pnl: number;
  realizedPnl: number;
  pnlPct: number;
  status: "open" | "closed";
  openedAt: number;
}

export interface PortfolioSummary {
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  openCount: number;
  closedCount: number;
}

export interface PortfolioHistoryPoint {
  timestamp: number;
  value: number;
}

export interface PortfolioData {
  positions: AccountPosition[];
  summary: PortfolioSummary;
  history: PortfolioHistoryPoint[];
}

const POSITION_EVENTS = parseAbi([
  "event SharesBought(uint256 indexed marketId,address indexed buyer,uint256 outcome,uint256 shares,uint256 cost)",
  "event SharesSold(uint256 indexed marketId,address indexed seller,uint256 outcome,uint256 shares,uint256 proceeds)",
]);

export const PORTFOLIO_REFRESH_EVENT = "gatedelay:portfolio-refresh";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Portfolio response contains an invalid ${label}`);
  return parsed;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Portfolio response is missing ${label}`);
  }
  return value;
}

export function getAccessToken(): string {
  if (typeof window === "undefined") throw new Error("Authentication is required to load your portfolio.");
  const token =
    window.localStorage.getItem("accessToken") ??
    window.localStorage.getItem("access_token");
  if (!token) throw new Error("Sign in to load your authenticated portfolio.");
  return token;
}

export function getAuthenticatedUserId(token: string): string {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("The access token is not a valid JWT.");

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isObject(claims) || typeof claims.sub !== "string" || !claims.sub) {
      throw new Error("The access token does not contain a user identity.");
    }
    return claims.sub;
  } catch (error) {
    if (error instanceof Error && error.message === "The access token does not contain a user identity.") {
      throw error;
    }
    throw new Error("The access token payload could not be decoded.");
  }
}

async function requestApi(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`${resolveApiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  let body: unknown;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      if (response.ok) throw new Error("The portfolio API returned malformed JSON.");
      body = text;
    }
  }

  if (!response.ok) {
    const message = isObject(body) && typeof body.message === "string"
      ? body.message
      : typeof body === "string" && body
        ? body
        : `Portfolio API request failed (${response.status}).`;
    throw new Error(message);
  }
  if (body === undefined) throw new Error("The portfolio API returned an empty response.");
  return body;
}

function parsePosition(value: unknown): AccountPosition {
  if (!isObject(value)) throw new Error("Portfolio API returned an invalid position.");
  const side = value.side;
  const status = value.status;
  if (side !== "YES" && side !== "NO") throw new Error("Portfolio API returned an invalid position side.");
  if (status !== "open" && status !== "closed") throw new Error("Portfolio API returned an invalid position status.");
  const openedAt = new Date(String(value.openedAt)).getTime();
  if (!Number.isFinite(openedAt)) throw new Error("Portfolio API returned an invalid position date.");

  return {
    id: asString(value.id, "position id"),
    account: asString(value.account, "position account"),
    chainId: asString(value.chainId, "position chain"),
    marketId: asString(value.marketId, "position market"),
    side,
    shares: asNumber(value.shares, "position shares"),
    sharesExact: asString(value.shares, "position shares"),
    entryPrice: asNumber(value.entryPrice, "position entry price"),
    currentPrice: asNumber(value.currentPrice, "position current price"),
    costBasis: asNumber(value.costBasis, "position cost basis"),
    pnl: asNumber(value.pnl, "position P&L"),
    realizedPnl: asNumber(value.realizedPnl, "realized P&L"),
    pnlPct: asNumber(value.pnlPct, "position P&L percentage"),
    status,
    openedAt,
  };
}

export async function fetchAuthenticatedPositions(signal?: AbortSignal): Promise<AccountPosition[]> {
  const token = getAccessToken();
  const response = await requestApi("/positions", token, { signal });
  if (!Array.isArray(response)) throw new Error("Portfolio API returned an invalid positions list.");
  return response.map(parsePosition);
}

function parseSummary(value: unknown): PortfolioSummary {
  if (!isObject(value)) throw new Error("Portfolio API returned an invalid summary.");
  return {
    totalCost: asNumber(value.totalCost, "total cost"),
    totalPnl: asNumber(value.totalPnl, "total P&L"),
    totalPnlPct: asNumber(value.totalPnlPct, "total P&L percentage"),
    openCount: asNumber(value.openCount, "open position count"),
    closedCount: asNumber(value.closedCount, "closed position count"),
  };
}

function parseHistory(value: unknown): PortfolioHistoryPoint[] {
  if (!Array.isArray(value)) throw new Error("Portfolio API returned an invalid history list.");
  return value.map((entry) => {
    if (!isObject(entry)) throw new Error("Portfolio API returned an invalid history point.");
    const timestamp = new Date(String(entry.timestamp)).getTime();
    if (!Number.isFinite(timestamp)) throw new Error("Portfolio API returned an invalid history date.");
    return {
      timestamp,
      value: asNumber(entry.totalCost, "history cost") + asNumber(entry.totalPnl, "history P&L"),
    };
  });
}

export async function fetchPortfolioData(signal?: AbortSignal): Promise<PortfolioData> {
  const token = getAccessToken();
  const [positionsResponse, summaryResponse, historyResponse] = await Promise.all([
    requestApi("/positions", token, { signal }),
    requestApi("/portfolio", token, { signal }),
    requestApi("/portfolio/history", token, { signal }),
  ]);
  if (!Array.isArray(positionsResponse)) {
    throw new Error("Portfolio API returned an invalid positions list.");
  }
  return {
    positions: positionsResponse.map(parsePosition),
    summary: parseSummary(summaryResponse),
    history: parseHistory(historyResponse),
  };
}

interface ExecutionLog {
  address: string;
  data: Hex;
  topics: readonly Hex[];
  logIndex: number | null;
}

interface ExecutionReceipt {
  transactionHash: Hex;
  logs: readonly ExecutionLog[];
}

interface RecordExecutionOptions {
  action: "BUY" | "SELL";
  account: `0x${string}`;
  chainId: number;
  marketId: bigint;
  receipt: ExecutionReceipt;
  positionId?: string;
  signMessage: (message: string) => Promise<Hex>;
}

export function getMarketMakerAddress(chainId: number): `0x${string}` {
  const rawRegistry = process.env.NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON;
  if (!rawRegistry) throw new Error("MarketMaker deployment registry is not configured.");
  const deployment = parseDeploymentRegistry(rawRegistry).find(
    (entry) => entry.name === "MarketMaker" && entry.chainId === chainId,
  );
  if (!deployment) throw new Error(`MarketMaker is not configured for chain ${chainId}.`);
  return deployment.address;
}

export async function recordPositionExecution({
  action,
  account,
  chainId,
  marketId,
  receipt,
  positionId,
  signMessage,
}: RecordExecutionOptions): Promise<void> {
  const contractAddress = getMarketMakerAddress(chainId);
  const eventName = action === "BUY" ? "SharesBought" : "SharesSold";
  let executionLog: ExecutionLog | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase() || log.logIndex === null) continue;
    const [signature, ...indexedTopics] = log.topics;
    if (!signature) continue;
    try {
      const decoded = decodeEventLog({
        abi: POSITION_EVENTS,
        data: log.data,
        topics: [signature, ...indexedTopics],
        strict: false,
      });
      const eventActor = decoded.eventName === "SharesBought"
        ? decoded.args.buyer
        : decoded.eventName === "SharesSold"
          ? decoded.args.seller
          : undefined;
      if (
        decoded.eventName === eventName &&
        decoded.args.marketId === marketId &&
        eventActor?.toLowerCase() === account.toLowerCase()
      ) {
        executionLog = log;
        break;
      }
    } catch {
      // Other MarketMaker logs in this receipt are not position executions.
    }
  }
  if (!executionLog || executionLog.logIndex === null) {
    throw new Error(`The confirmed transaction did not contain a matching ${eventName} event.`);
  }

  const token = getAccessToken();
  const userId = getAuthenticatedUserId(token);
  const message = [
    "GateDelay position execution v1",
    userId,
    String(chainId),
    contractAddress.toLowerCase(),
    receipt.transactionHash.toLowerCase(),
    String(executionLog.logIndex),
  ].join("\n");
  const signature = await signMessage(message);
  const path = positionId
    ? `/positions/${encodeURIComponent(positionId)}`
    : "/positions";
  await requestApi(path, token, {
    method: positionId ? "DELETE" : "POST",
    body: JSON.stringify({
      txHash: receipt.transactionHash,
      logIndex: executionLog.logIndex,
      signature,
    }),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PORTFOLIO_REFRESH_EVENT));
  }
}
