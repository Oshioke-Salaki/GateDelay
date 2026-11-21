"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    useAccount,
    usePublicClient,
    useSignMessage,
    useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import CloseConfirmation from "@/components/position/CloseConfirmation";
import {
    fetchAuthenticatedPositions,
    getMarketMakerAddress,
    recordPositionExecution,
    type AccountPosition,
} from "@/lib/portfolioApi";

const MARKET_MAKER_ABI = [
    {
        name: "sell",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "marketId", type: "uint256" },
            { name: "outcome", type: "uint256" },
            { name: "shares", type: "uint256" },
        ],
        outputs: [],
    },
] as const;

interface UserPositionsProps {
    marketId: string;
    userAddress: string;
}

function positionMarketName(position: AccountPosition): string {
    return `Market #${position.marketId}`;
}

export default function UserPositions({ marketId, userAddress }: UserPositionsProps) {
    const { address: connectedAddress, chainId } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const { signMessageAsync } = useSignMessage();
    const [positions, setPositions] = useState<AccountPosition[]>([]);
    const [activeTab, setActiveTab] = useState<"open" | "history">("open");
    const [closingPosition, setClosingPosition] = useState<AccountPosition | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSelling, setIsSelling] = useState(false);
    const [isSyncRetrying, setIsSyncRetrying] = useState(false);
    const [pendingExecution, setPendingExecution] = useState<
        Parameters<typeof recordPositionExecution>[0] | null
    >(null);
    const [error, setError] = useState<string | null>(null);

    const refreshPositions = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
        setLoading(true);
        try {
            const allPositions = await fetchAuthenticatedPositions(signal);
            if (signal?.aborted) return false;
            setPositions(
                allPositions.filter(
                    (position) =>
                        position.marketId === marketId &&
                        position.account.toLowerCase() === userAddress.toLowerCase(),
                ),
            );
            setError(null);
            return true;
        } catch (requestError) {
            if (signal?.aborted) return false;
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Could not load your positions.",
            );
            return false;
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [marketId, userAddress]);

    useEffect(() => {
        const controller = new AbortController();
        void refreshPositions(controller.signal);
        return () => controller.abort();
    }, [refreshPositions]);

    const openPositions = useMemo(
        () => positions.filter((position) => position.status === "open"),
        [positions],
    );
    const closedPositions = useMemo(
        () => positions.filter((position) => position.status === "closed"),
        [positions],
    );
    const totalValue = openPositions.reduce(
        (sum, position) => sum + position.currentPrice * position.shares,
        0,
    );
    const totalPnl = openPositions.reduce((sum, position) => sum + position.pnl, 0);
    const costBasis = openPositions.reduce((sum, position) => sum + position.costBasis, 0);
    const totalPnlPercent = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;

    const closePosition = async (position: AccountPosition, sharesToClose: string) => {
        if (!connectedAddress || connectedAddress.toLowerCase() !== userAddress.toLowerCase()) {
            throw new Error("Connect the wallet that owns this position before selling.");
        }
        if (!chainId || !publicClient) {
            throw new Error("The connected wallet does not have a supported network client.");
        }
        if (position.chainId !== String(chainId)) {
            throw new Error(`Switch to chain ${position.chainId} to sell this position.`);
        }

        setIsSelling(true);
        setError(null);
        let transactionConfirmed = false;
        try {
            const hash = await writeContractAsync({
                address: getMarketMakerAddress(chainId),
                abi: MARKET_MAKER_ABI,
                functionName: "sell",
                args: [
                    BigInt(position.marketId),
                    BigInt(position.side === "YES" ? 0 : 1),
                    parseUnits(sharesToClose, 18),
                ],
            });
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 12,
            });
            if (receipt.status !== "success") {
                throw new Error("The sell transaction reverted; your position was not changed.");
            }
            transactionConfirmed = true;
            const execution = {
                action: "SELL",
                account: connectedAddress,
                chainId,
                marketId: BigInt(position.marketId),
                positionId: position.id,
                receipt,
                signMessage: (message) => signMessageAsync({ message }),
            } satisfies Parameters<typeof recordPositionExecution>[0];
            setPendingExecution(execution);
            await recordPositionExecution(execution);
            if (!(await refreshPositions())) {
                throw new Error("Sale confirmed, but updated positions could not be loaded. Retry account sync.");
            }
            setPendingExecution(null);
            setClosingPosition(null);
        } catch (sellError) {
            const message = sellError instanceof Error
                ? sellError.message
                : "The position could not be sold.";
            setError(message);
            if (transactionConfirmed) setClosingPosition(null);
            throw sellError;
        } finally {
            setIsSelling(false);
        }
    };

    const retryPositionSync = async () => {
        if (!pendingExecution) return;
        setIsSyncRetrying(true);
        try {
            await recordPositionExecution(pendingExecution);
            if (!(await refreshPositions())) {
                throw new Error("Updated positions could not be loaded. Please retry account sync.");
            }
            setPendingExecution(null);
            setError(null);
        } catch (syncError) {
            setError(syncError instanceof Error ? syncError.message : "Could not sync the confirmed sale.");
        } finally {
            setIsSyncRetrying(false);
        }
    };

    const renderRows = (rows: AccountPosition[], allowClose: boolean) => {
        if (rows.length === 0) {
            return (
                <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500" role="status">
                        {allowClose ? "No open positions" : "No closed positions"}
                    </td>
                </tr>
            );
        }
        return rows.map((position) => {
            const pnl = position.status === "closed" ? position.realizedPnl : position.pnl;
            return (
                <tr key={position.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            position.side === "YES" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                            {position.side}
                        </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                        ${position.entryPrice.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                        ${position.currentPrice.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                        {position.shares.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                        ${(position.currentPrice * position.shares).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                        <div className={`font-mono text-sm font-semibold ${
                            pnl >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                        </div>
                        {position.status === "open" && (
                            <div className={`text-xs ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                                ({position.pnlPct >= 0 ? "+" : ""}{position.pnlPct.toFixed(2)}%)
                            </div>
                        )}
                    </td>
                    <td className="px-4 py-3 text-right">
                        {allowClose && (
                            <button
                                onClick={() => setClosingPosition(position)}
                                disabled={isSelling || !!pendingExecution}
                                className="rounded px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                            >
                                Close
                            </button>
                        )}
                    </td>
                </tr>
            );
        });
    };

    return (
        <div className="rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Your Positions</h3>
                    <div className="mt-1 flex items-center space-x-4 text-sm">
                        <span className="text-gray-600">
                            Total Value: <span className="font-semibold">${totalValue.toFixed(2)}</span>
                        </span>
                        <span className={`font-semibold ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            P&amp;L: {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)} ({totalPnlPercent.toFixed(2)}%)
                        </span>
                    </div>
                </div>
                <div className="flex space-x-1 rounded-lg bg-gray-100 p-1">
                    {(["open", "history"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`rounded px-4 py-2 text-sm font-medium capitalize transition-colors ${
                                activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            {tab === "open" ? "Open Positions" : "History"}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div role="alert" className="px-4 pt-3 text-sm text-red-700">
                    <p>{pendingExecution ? `Sale confirmed, but account sync failed: ${error}` : error}</p>
                    {pendingExecution && (
                        <button
                            onClick={() => void retryPositionSync()}
                            disabled={isSyncRetrying}
                            className="mt-2 rounded border border-red-300 px-3 py-1 text-xs disabled:opacity-50"
                        >
                            {isSyncRetrying ? "Retrying account sync…" : "Retry account sync"}
                        </button>
                    )}
                </div>
            )}
            {loading ? (
                <p className="p-8 text-center text-gray-500" role="status">Loading positions…</p>
            ) : error && positions.length === 0 ? null : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-gray-200 bg-gray-50">
                            <tr>
                                {["Side", "Entry Price", "Current Price", "Quantity", "Value", "P&L", "Actions"].map((heading) => (
                                    <th key={heading} className="px-4 py-3 text-right text-xs font-semibold text-gray-600 first:text-left">
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {renderRows(activeTab === "open" ? openPositions : closedPositions, activeTab === "open")}
                        </tbody>
                    </table>
                </div>
            )}

            {closingPosition && (
                <CloseConfirmation
                    isOpen
                    onClose={() => {
                        if (!isSelling && !pendingExecution) setClosingPosition(null);
                    }}
                    onConfirmExact={(sharesToClose) => closePosition(closingPosition, sharesToClose)}
                    position={{
                        id: closingPosition.id,
                        marketName: positionMarketName(closingPosition),
                        side: closingPosition.side,
                        shares: closingPosition.shares,
                        sharesExact: closingPosition.sharesExact,
                        entryPrice: closingPosition.entryPrice,
                        currentPrice: closingPosition.currentPrice,
                    }}
                />
            )}
        </div>
    );
}
