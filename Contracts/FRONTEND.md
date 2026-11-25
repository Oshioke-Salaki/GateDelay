
export interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  timestamp: string;
  transactionHash?: string;
  source: "contract" | "backend";
}

export interface LiquidityRecord {
  timestamp: string;
  tokenAmount: number;
  usdValue: number;
  bidDepth?: number;
  askDepth?: number;
}

export interface ConfirmedFill {
  id: string;
  timestamp: string;
  quantity: number;
  price: number;
  status: "confirmed";
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchApi<T>(endpoint: string): Promise<T> {
  if (!API_URL) {
    throw new Error("API URL is not configured");
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export async function getTimelineEvents(
  contractAddress: string
): Promise<TimelineEvent[]> {
  const [contractEvents, lifecycleEvents] = await Promise.all([
    fetchApi<TimelineEvent[]>(
      `/contracts/${contractAddress}/events`
    ),
    fetchApi<TimelineEvent[]>(
      `/contracts/${contractAddress}/lifecycle`
    ),
  ]);

  const uniqueEvents = new Map<string, TimelineEvent>();

  [...contractEvents, ...lifecycleEvents].forEach((event) => {
    uniqueEvents.set(event.id, event);
  });

  return Array.from(uniqueEvents.values()).sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime()
  );
}

export async function getLiquidityRecords(
  marketId: string
): Promise<LiquidityRecord[]> {
  return fetchApi<LiquidityRecord[]>(
    `/markets/${marketId}/liquidity`
  );
}

export async function getConfirmedFills(
  marketId: string,
  timeframe: string
): Promise<ConfirmedFill[]> {
  return fetchApi<ConfirmedFill[]>(
    `/markets/${marketId}/fills?timeframe=${timeframe}&status=confirmed`
  );
}
