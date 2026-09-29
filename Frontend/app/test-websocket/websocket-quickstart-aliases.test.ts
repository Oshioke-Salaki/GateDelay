import { describe, it, expect } from "vitest";
import PriceDisplay from "@/app/components/market/PriceDisplay";
import MarketPriceList from "@/app/components/market/MarketPriceList";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "@/app/components/WebSocketProvider";
import { usePriceUpdates, useSinglePriceUpdate } from "@/hooks/usePriceUpdates";
import { useWebSocket } from "@/hooks/useWebSocket";

/**
 * Guards WEBSOCKET_QUICKSTART.md examples against stale aliases
 * (for example @/src/... which is not configured).
 */
describe("WEBSOCKET_QUICKSTART TypeScript path aliases", () => {
  it("resolves documented @/ imports to real modules", () => {
    expect(typeof PriceDisplay).toBe("function");
    expect(typeof MarketPriceList).toBe("function");
    expect(typeof WebSocketProvider).toBe("function");
    expect(typeof useWebSocketContext).toBe("function");
    expect(typeof usePriceUpdates).toBe("function");
    expect(typeof useSinglePriceUpdate).toBe("function");
    expect(typeof useWebSocket).toBe("function");
  });
});
