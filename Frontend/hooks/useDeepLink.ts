"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketDeepLinkParams {
    marketId: string;
    outcome?: "yes" | "no";
    side?: "buy" | "sell";
    tab?: string;
}

export interface DeepLinkState {
    isMarketLink: boolean;
    params: MarketDeepLinkParams | null;
    isValid: boolean;
}

export interface NavigationOptions {
    scrollToTop?: boolean;
    replace?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeepLink(autoNavigate: boolean = true) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [state, setState] = useState<DeepLinkState>({
        isMarketLink: false,
        params: null,
        isValid: false,
    });

    const parseDeepLink = useCallback((): DeepLinkState => {
        const marketId = searchParams.get("marketId");
        const outcome = searchParams.get("outcome") as "yes" | "no" | null;
        const side = searchParams.get("side") as "buy" | "sell" | null;
        const tab = searchParams.get("tab");

        if (!marketId) {
            return { isMarketLink: false, params: null, isValid: true };
        }

        if (!/^\d+$/.test(marketId) && !/^0x[a-fA-F0-9]+$/.test(marketId)) {
            return {
                isMarketLink: true,
                params: { marketId },
                isValid: false,
            };
        }

        return {
            isMarketLink: true,
            params: {
                marketId,
                outcome: outcome || undefined,
                side: side || undefined,
                tab: tab || undefined,
            },
            isValid: true,
        };
    }, [searchParams]);

    useEffect(() => {
        const parsed = parseDeepLink();
        setState(parsed);
    }, [parseDeepLink]);

    const buildMarketUrl = useCallback(
        (params: MarketDeepLinkParams, options?: NavigationOptions): string => {
            const url = new URLSearchParams();

            url.set("marketId", params.marketId);

            if (params.outcome) {
                url.set("outcome", params.outcome);
            }
            if (params.side) {
                url.set("side", params.side);
            }
            if (params.tab) {
                url.set("tab", params.tab);
            }

            const query = url.toString();
            return query ? `${pathname}?${query}` : pathname;
        },
        [pathname]
    );

    const navigateToMarket = useCallback(
        (params: MarketDeepLinkParams, opts?: NavigationOptions) => {
            const url = buildMarketUrl(params);

            if (opts?.replace) {
                router.replace(url);
            } else {
                router.push(url);
            }

            if (opts?.scrollToTop) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        },
        [router, buildMarketUrl]
    );

    const generateShareableLink = useCallback(
        (params: MarketDeepLinkParams): string => {
            const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
            const url = buildMarketUrl(params);
            return `${baseUrl}${url}`;
        },
        [buildMarketUrl]
    );

    const copyShareLink = useCallback(
        async (params: MarketDeepLinkParams): Promise<boolean> => {
            const link = generateShareableLink(params);
            try {
                await navigator.clipboard.writeText(link);
                return true;
            } catch {
                return false;
            }
        },
        [generateShareableLink]
    );

    const clearDeepLink = useCallback(() => {
        router.replace(pathname);
    }, [router, pathname]);

    const getMarketState = useCallback(() => {
        if (!state.isMarketLink || !state.params) return null;

        return {
            marketId: state.params.marketId,
            selectedOutcome: state.params.outcome,
            tradeSide: state.params.side,
            activeTab: state.params.tab || "overview",
        };
    }, [state]);

    return {
        state,
        parseDeepLink,
        buildMarketUrl,
        navigateToMarket,
        generateShareableLink,
        copyShareLink,
        clearDeepLink,
        getMarketState,
        currentParams: state.params,
        isMarketLink: state.isMarketLink,
        isValid: state.isValid,
    };
}

// ─── Utility Functions ─────────────────────────────────────────────────────────

export function isMarketDeepLink(url: string | URL): boolean {
    const urlObj = typeof url === "string" ? new URL(url, typeof window !== "undefined" ? window.location.origin : "") : url;
    return urlObj.searchParams.has("marketId");
}

export function extractMarketId(url: string | URL): string | null {
    try {
        const urlObj = typeof url === "string" ? new URL(url, typeof window !== "undefined" ? window.location.origin : "") : url;
        return urlObj.searchParams.get("marketId");
    } catch {
        return null;
    }
}

export function createMarketShareUrl(
    marketId: string,
    options?: { outcome?: "yes" | "no"; side?: "buy" | "sell"; tab?: string }
): string {
    const params = new URLSearchParams();
    params.set("marketId", marketId);

    if (options?.outcome) params.set("outcome", options.outcome);
    if (options?.side) params.set("side", options.side);
    if (options?.tab) params.set("tab", options.tab);

    return `/markets?${params.toString()}`;
}

// ─── Hook for Market URL Synchronization ──────────────────────────────────────

export function useMarketUrlSync(
    marketId: string | undefined,
    options?: { outcome?: "yes" | "no"; side?: "buy" | "sell" }
) {
    const router = useRouter();

    useEffect(() => {
        if (!marketId) return;

        const params = new URLSearchParams();
        params.set("marketId", marketId);

        if (options?.outcome) params.set("outcome", options.outcome);
        if (options?.side) params.set("side", options.side);

        const url = `/markets?${params.toString()}`;
        router.replace(url);
    }, [marketId, router, options?.outcome, options?.side]);
}

// ─── Hook for Parsing Share Links ───────────────────────────────────────────────

export function useShareLink() {
    const [isCopied, setIsCopied] = useState(false);

    const shareMarket = useCallback(async (url: string): Promise<boolean> => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "GateDelay Market",
                    text: "Check out this prediction market on GateDelay",
                    url,
                });
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }, []);

    const copyToClipboard = useCallback(async (text: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (e) {
            console.error("Failed to copy to clipboard", e);
        }
    }, []);

    return { shareMarket, copyToClipboard, isCopied };
}