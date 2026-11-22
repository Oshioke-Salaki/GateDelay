import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWebSocket } from "./useWebSocket";

const socketMock = vi.hoisted(() => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const subscriptionResponses: Array<{ error?: string; subscribed?: string[] }> = [];
    const socket: any = {
        connected: false,
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
            handlers.set(event, handler);
            return socket;
        }),
        off: vi.fn(),
        connect: vi.fn(() => {
            socket.connected = true;
            handlers.get("connect")?.();
            return socket;
        }),
        disconnect: vi.fn(() => {
            socket.connected = false;
            handlers.get("disconnect")?.("io client disconnect");
            return socket;
        }),
        timeout: vi.fn(() => socket),
        emit: vi.fn((event: string, _payload: unknown, acknowledge?: (...args: any[]) => void) => {
            if (event === "subscribe") {
                acknowledge?.(null, subscriptionResponses.shift() ?? {});
            }
            return socket;
        }),
        handlers,
        subscriptionResponses,
    };

    return socket;
});

vi.mock("socket.io-client", () => ({
    io: vi.fn(() => socketMock),
}));

describe("useWebSocket retry behavior", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        socketMock.handlers.clear();
        socketMock.subscriptionResponses.length = 0;
        socketMock.connected = false;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("retries a failed subscription acknowledgement", () => {
        socketMock.subscriptionResponses.push({ error: "subscription rejected" }, { subscribed: ["market-1"] });
        const { result, unmount } = renderHook(() =>
            useWebSocket({ url: "http://localhost:3000", autoConnect: false, reconnectionDelay: 100 }),
        );

        act(() => result.current.connect());
        act(() => result.current.subscribe(["market-1"]));

        expect(result.current.status).toBe("error");
        act(() => vi.advanceTimersByTime(100));

        expect(socketMock.emit).toHaveBeenCalledTimes(2);
        expect(result.current.status).toBe("connected");
        unmount();
    });

    it("manually reconnects and restores subscriptions after disconnect", () => {
        const { result, unmount } = renderHook(() =>
            useWebSocket({ url: "http://localhost:3000", autoConnect: false }),
        );

        act(() => result.current.connect());
        act(() => result.current.subscribe(["market-1"]));
        act(() => socketMock.disconnect());

        expect(result.current.status).toBe("disconnected");
        act(() => result.current.connect());

        expect(socketMock.connect).toHaveBeenCalledTimes(2);
        expect(socketMock.emit).toHaveBeenCalledWith("subscribe", { marketIds: ["market-1"] }, expect.any(Function));
        expect(result.current.status).toBe("connected");
        unmount();
    });
});
