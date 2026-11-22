"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Clock3,
  Hash,
  Loader2,
  RadioTower,
  RefreshCcw,
  Rss,
} from "lucide-react";
import { useIPFS } from "@/hooks/useIPFS";
import { useToast } from "@/hooks/useToast";

interface FeedEntry {
  id: string;
  title: string;
  summary: string;
  content: string;
  author: string;
  category: string;
  cid: string;
  publishedAt: string;
}

interface FeedMetadata {
  title: string;
  description: string;
  protocol: "IPFS" | "IPNS";
  publisher: string;
  subscribers: number;
  tags: string[];
  updatedAt: string;
  version: number;
}

interface FeedSnapshot {
  metadata: FeedMetadata;
  entries: FeedEntry[];
}

export interface FeedSource {
  id: string;
  name: string;
  hash: string;
  protocol: "IPFS" | "IPNS";
  description: string;
  seedData?: FeedSnapshot;
}

interface DecentralizedReaderProps {
  feeds?: FeedSource[];
  storageKey?: string;
  refreshIntervalMs?: number;
}

const DEFAULT_FEEDS: FeedSource[] = [
  {
    id: "flight-desk",
    name: "Flight Desk Wire",
    hash: "QmFlightDeskWire0123456789abcdefghijklmnopqrstuv",
    protocol: "IPNS",
    description: "Operational updates on routes, airport congestion, and hedging events.",
    seedData: {
      metadata: {
        title: "Flight Desk Wire",
        description: "Short-form dispatches covering route congestion and market-moving travel events.",
        protocol: "IPNS",
        publisher: "GateDelay Labs",
        subscribers: 1824,
        tags: ["travel", "markets", "operations"],
        updatedAt: "2026-06-30T07:30:00Z",
        version: 12,
      },
      entries: [
        {
          id: "flight-desk-1",
          title: "Northeast corridor delays are compressing short-dated pricing",
          summary: "A surge in weather-related holds is concentrating volume into hourly resolution markets.",
          content:
            "Boston, New York, and Philadelphia all posted elevated gate hold times overnight. Traders shifted toward shorter expiries as airline ops teams rebalanced equipment.",
          author: "Ops Desk",
          category: "Market Update",
          cid: "bafybeiflightdeskentry1",
          publishedAt: "2026-06-30T07:12:00Z",
        },
        {
          id: "flight-desk-2",
          title: "Liquidity providers widened spreads before the morning push",
          summary: "Market makers responded to uncertainty by increasing risk buffers in the first trading window.",
          content:
            "The largest adjustment landed in JFK and Newark contracts where overnight cancellations forced repricing. Spread normalization started after the first departure bank cleared.",
          author: "Liquidity Team",
          category: "Liquidity",
          cid: "bafybeiflightdeskentry2",
          publishedAt: "2026-06-30T06:20:00Z",
        },
      ],
    },
  },
  {
    id: "defi-ops",
    name: "DeFi Ops Feed",
    hash: "QmDefiOpsFeed0123456789abcdefghijklmnopqrstuvwxy",
    protocol: "IPFS",
    description: "Governance, vault routing, and emissions updates for on-chain strategies.",
    seedData: {
      metadata: {
        title: "DeFi Ops Feed",
        description: "Protocol notes, treasury changes, and strategy operations posted to decentralized storage.",
        protocol: "IPFS",
        publisher: "Treasury Council",
        subscribers: 964,
        tags: ["governance", "treasury", "defi"],
        updatedAt: "2026-06-30T06:45:00Z",
        version: 8,
      },
      entries: [
        {
          id: "defi-ops-1",
          title: "Epoch emission schedule moved to a lower dilution bracket",
          summary: "The next weekly release trims reward output while preserving LP incentives in core markets.",
          content:
            "The treasury committee approved a step-down in incentive emissions and concentrated rewards in the highest-retention pools. Existing farmers keep eligibility through the end of the epoch.",
          author: "Council Relay",
          category: "Governance",
          cid: "bafybeidefiopsentry1",
          publishedAt: "2026-06-30T05:55:00Z",
        },
        {
          id: "defi-ops-2",
          title: "Bridge queue cleared after sequencer backlog normalized",
          summary: "Delayed settlement activity has returned to baseline after overnight congestion.",
          content:
            "Pending withdrawals that accumulated during the backlog are now finalizing within normal windows. Routing automation has been restored for standard transfer sizes.",
          author: "Bridge Monitor",
          category: "Infrastructure",
          cid: "bafybeidefiopsentry2",
          publishedAt: "2026-06-30T04:18:00Z",
        },
      ],
    },
  },
];

function formatRelativeTime(date: string): string {
  const delta = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(delta / 60_000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function cloneSnapshot(snapshot: FeedSnapshot): FeedSnapshot {
  return {
    metadata: {
      ...snapshot.metadata,
      tags: [...snapshot.metadata.tags],
    },
    entries: snapshot.entries.map((entry) => ({ ...entry })),
  };
}

function buildSeedSnapshot(source: FeedSource, refreshCount: number): FeedSnapshot {
  const seed = cloneSnapshot(source.seedData!);

  if (refreshCount <= 0) {
    return seed;
  }

  const updateTimestamp = new Date(Date.now() - refreshCount * 60_000).toISOString();
  seed.metadata.updatedAt = updateTimestamp;
  seed.metadata.version += refreshCount;
  seed.entries = [
    {
      id: `${source.id}-refresh-${refreshCount}`,
      title: "Fresh index announcement",
      summary: `${source.name} published a new content index and the reader synced it automatically.`,
      content:
        "This generated update mirrors what a new IPNS/IPFS head would look like in the UI so subscription and refresh behavior can be tested before live content is connected.",
      author: source.name,
      category: "Sync",
      cid: `${source.hash}-refresh-${refreshCount}`,
      publishedAt: updateTimestamp,
    },
    ...seed.entries,
  ];

  return seed;
}

function normalizeRetrievedFeed(data: unknown, fallbackSource: FeedSource): FeedSnapshot {
  if (
    typeof data === "object" &&
    data !== null &&
    "metadata" in data &&
    "entries" in data &&
    Array.isArray((data as { entries: unknown[] }).entries)
  ) {
    return data as FeedSnapshot;
  }

  if (Array.isArray(data)) {
    return {
      metadata: {
        title: fallbackSource.name,
        description: fallbackSource.description,
        protocol: fallbackSource.protocol,
        publisher: "Unknown publisher",
        subscribers: 0,
        tags: ["imported"],
        updatedAt: new Date().toISOString(),
        version: 1,
      },
      entries: data.map((entry, index) => ({
        id: `${fallbackSource.id}-${index}`,
        title: `Imported post ${index + 1}`,
        summary: JSON.stringify(entry).slice(0, 120),
        content: JSON.stringify(entry, null, 2),
        author: "Imported feed",
        category: "Imported",
        cid: `${fallbackSource.hash}-${index}`,
        publishedAt: new Date().toISOString(),
      })),
    };
  }

  return {
    metadata: {
      title: fallbackSource.name,
      description: fallbackSource.description,
      protocol: fallbackSource.protocol,
      publisher: "Unknown publisher",
      subscribers: 0,
      tags: ["imported"],
      updatedAt: new Date().toISOString(),
      version: 1,
    },
    entries: [
      {
        id: `${fallbackSource.id}-payload`,
        title: "Imported payload",
        summary: "The reader recovered a non-standard payload and wrapped it for display.",
        content: JSON.stringify(data, null, 2),
        author: "Imported feed",
        category: "Imported",
        cid: fallbackSource.hash,
        publishedAt: new Date().toISOString(),
      },
    ],
  };
}

export default function DecentralizedReader({
  feeds = DEFAULT_FEEDS,
  storageKey = "gatedelay-feed-subscriptions",
  refreshIntervalMs = 15_000,
}: DecentralizedReaderProps) {
  const toast = useToast();
  const { retrieve } = useIPFS();
  const [activeFeedId, setActiveFeedId] = useState<string>(feeds[0]?.id ?? "");
  const [customHash, setCustomHash] = useState("");
  const [customFeed, setCustomFeed] = useState<FeedSource | null>(null);
  const [subscribedIds, setSubscribedIds] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<FeedSnapshot | null>(feeds[0]?.seedData ?? null);
  const [refreshCount, setRefreshCount] = useState<Record<string, number>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const feedOptions = useMemo(() => {
    return customFeed ? [customFeed, ...feeds] : feeds;
  }, [customFeed, feeds]);

  const activeFeed = useMemo(() => {
    return feedOptions.find((item) => item.id === activeFeedId) ?? feedOptions[0] ?? null;
  }, [activeFeedId, feedOptions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        setSubscribedIds(JSON.parse(raw) as string[]);
      }
    } catch {
      setSubscribedIds([]);
    }
  }, [storageKey]);

  const persistSubscriptions = useCallback(
    (next: string[]) => {
      setSubscribedIds(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
    },
    [storageKey]
  );

  const loadFeed = useCallback(
    async (source: FeedSource, nextRefreshCount = 0) => {
      setIsRefreshing(true);

      try {
        if (source.seedData) {
          const seeded = buildSeedSnapshot(source, nextRefreshCount);
          setSnapshot(seeded);
          return;
        }

        const payload = await retrieve(source.hash);
        setSnapshot(normalizeRetrievedFeed(payload, source));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load decentralized feed.";
        toast.error("Feed sync failed", message);
      } finally {
        setIsRefreshing(false);
      }
    },
    [retrieve, toast]
  );

  useEffect(() => {
    if (!activeFeed) {
      return;
    }

    void loadFeed(activeFeed, refreshCount[activeFeed.id] ?? 0);
  }, [activeFeed, loadFeed, refreshCount]);

  useEffect(() => {
    if (!autoRefresh || !activeFeed) {
      return;
    }

    const interval = window.setInterval(() => {
      setRefreshCount((current) => ({
        ...current,
        [activeFeed.id]: (current[activeFeed.id] ?? 0) + 1,
      }));
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [activeFeed, autoRefresh, refreshIntervalMs]);

  const handleSubscriptionToggle = useCallback(() => {
    if (!activeFeed) {
      return;
    }

    const isSubscribed = subscribedIds.includes(activeFeed.id);
    const next = isSubscribed
      ? subscribedIds.filter((id) => id !== activeFeed.id)
      : [...subscribedIds, activeFeed.id];

    persistSubscriptions(next);

    toast.success(
      isSubscribed ? "Subscription removed" : "Subscribed to feed",
      `${activeFeed.name} ${isSubscribed ? "will stop" : "will keep"} syncing in your reader.`
    );
  }, [activeFeed, persistSubscriptions, subscribedIds, toast]);

  const handleCustomLoad = useCallback(async () => {
    const targetHash = customHash.trim();
    if (!targetHash) {
      toast.warning("Hash required", "Paste an IPFS or IPNS hash to load a custom feed.");
      return;
    }

    setIsRefreshing(true);

    try {
      const payload = await retrieve(targetHash);
      const source: FeedSource = {
        id: "custom-feed",
        name: "Custom Feed",
        hash: targetHash,
        protocol: targetHash.startsWith("k") ? "IPNS" : "IPFS",
        description: "User-loaded decentralized content feed",
      };

      setCustomFeed(source);
      setActiveFeedId(source.id);
      setSnapshot(normalizeRetrievedFeed(payload, source));
      toast.success("Custom feed loaded", "The decentralized reader parsed your feed payload.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not retrieve content.";
      toast.error("Custom feed failed", message);
    } finally {
      setIsRefreshing(false);
    }
  }, [customHash, retrieve, toast]);

  const isSubscribed = activeFeed ? subscribedIds.includes(activeFeed.id) : false;

  return (
    <section
      className="rounded-3xl p-6 space-y-6"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Rss className="w-5 h-5 text-cyan-500" />
            <h2 className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>
              Decentralized Reader
            </h2>
          </div>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
            Browse distributed content feeds, manage subscriptions, and keep metadata in sync with regular refreshes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(event) => setAutoRefresh(event.target.checked)}
              className="rounded"
            />
            Auto updates
          </label>

          <button
            type="button"
            onClick={() =>
              activeFeed &&
              setRefreshCount((current) => ({
                ...current,
                [activeFeed.id]: (current[activeFeed.id] ?? 0) + 1,
              }))
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              color: "#3b82f6",
              background: "rgba(59, 130, 246, 0.12)",
              border: "1px solid rgba(59, 130, 246, 0.22)",
            }}
          >
            {isRefreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Refresh now
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
              Available Feeds
            </p>
            <div className="space-y-2">
              {feedOptions.map((feed) => {
                const selected = feed.id === activeFeed?.id;
                return (
                  <button
                    key={feed.id}
                    type="button"
                    onClick={() => setActiveFeedId(feed.id)}
                    className="w-full text-left rounded-2xl p-3 transition-colors"
                    style={{
                      background: selected ? "rgba(6, 182, 212, 0.12)" : "var(--card)",
                      border: `1px solid ${selected ? "rgba(6, 182, 212, 0.28)" : "var(--border)"}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold" style={{ color: "var(--foreground)" }}>
                          {feed.name}
                        </p>
                        <p className="mt-1 text-xs leading-5" style={{ color: "var(--muted)" }}>
                          {feed.description}
                        </p>
                      </div>
                      <span
                        className="px-2 py-1 rounded-full text-[11px] font-semibold"
                        style={{ color: "#06b6d4", background: "rgba(6, 182, 212, 0.12)" }}
                      >
                        {feed.protocol}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--muted)" }}>
              Load Custom Feed
            </p>
            <input
              value={customHash}
              onChange={(event) => setCustomHash(event.target.value)}
              placeholder="Paste IPFS or IPNS hash"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            <button
              type="button"
              onClick={handleCustomLoad}
              className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: "#0891b2" }}
            >
              Load external feed
            </button>
          </div>
        </aside>

        <div className="space-y-4">
          {activeFeed && snapshot ? (
            <>
              <div
                className="rounded-2xl p-5 space-y-4"
                style={{ background: "var(--background)", border: "1px solid var(--border)" }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <RadioTower className="w-4 h-4 text-cyan-500" />
                      <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {snapshot.metadata.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--muted)" }}>
                      {snapshot.metadata.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSubscriptionToggle}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                    style={{
                      color: isSubscribed ? "#ef4444" : "#22c55e",
                      background: isSubscribed ? "rgba(239, 68, 68, 0.12)" : "rgba(34, 197, 94, 0.14)",
                      border: `1px solid ${isSubscribed ? "rgba(239, 68, 68, 0.26)" : "rgba(34, 197, 94, 0.24)"}`,
                    }}
                  >
                    <BellRing className="w-4 h-4" />
                    {isSubscribed ? "Unsubscribe" : "Subscribe"}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Publisher
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                      {snapshot.metadata.publisher}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Subscribers
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                      {snapshot.metadata.subscribers.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Version
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                      v{snapshot.metadata.version}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "var(--card)" }}>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>
                      Updated
                    </p>
                    <p className="mt-1 font-semibold" style={{ color: "var(--foreground)" }}>
                      {formatRelativeTime(snapshot.metadata.updatedAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--muted)" }}>
                  <span className="inline-flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" />
                    {activeFeed.hash}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5" />
                    {new Date(snapshot.metadata.updatedAt).toLocaleString()}
                  </span>
                  {snapshot.metadata.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full"
                      style={{ background: "rgba(148, 163, 184, 0.12)" }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {snapshot.entries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl p-5"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="px-2 py-1 rounded-full text-[11px] font-semibold"
                        style={{ color: "#06b6d4", background: "rgba(6, 182, 212, 0.12)" }}
                      >
                        {entry.category}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {entry.author}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {formatRelativeTime(entry.publishedAt)}
                      </span>
                    </div>
                    <h4 className="mt-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                      {entry.title}
                    </h4>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      {entry.summary}
                    </p>
                    <p className="mt-3 text-sm leading-6" style={{ color: "var(--foreground)" }}>
                      {entry.content}
                    </p>
                    <div className="mt-4 text-xs font-mono" style={{ color: "var(--muted)" }}>
                      CID: {entry.cid}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div
              className="rounded-2xl p-8 flex items-center justify-center"
              style={{ background: "var(--background)", border: "1px solid var(--border)" }}
            >
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--muted)" }} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
