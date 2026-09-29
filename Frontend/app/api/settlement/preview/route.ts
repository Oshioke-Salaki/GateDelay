import { NextResponse } from "next/server";
import { resolveApiBase, MissingApiBaseError } from "../../../../lib/apiBase";
import {
  describePayoutEffect,
  marketRevision,
  previewWarnings,
  type ResolutionOutcome,
  type SettlementPreview,
} from "../../../../lib/settlementPreview";

const OUTCOMES: ResolutionOutcome[] = ["YES", "NO", "VOID"];

function parseOutcome(value: string | null): ResolutionOutcome | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return OUTCOMES.includes(upper as ResolutionOutcome)
    ? (upper as ResolutionOutcome)
    : null;
}

function parseStake(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * GET /api/settlement/preview
 *
 * Assembles a *projected* settlement preview for the admin resolution UI.
 * Authoritative settlement still happens on the backend / chain — this route
 * never finalises a market. When the resolution service is reachable, its
 * current market status is preferred over the client snapshot.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId")?.trim();
  const outcome = parseOutcome(url.searchParams.get("outcome"));
  const snapshotStatus = url.searchParams.get("status")?.trim() || "unknown";
  const totalYesStake = parseStake(url.searchParams.get("totalYesStake"));
  const totalNoStake = parseStake(url.searchParams.get("totalNoStake"));

  if (!marketId || !outcome) {
    return NextResponse.json(
      { error: "marketId and a YES/NO/VOID outcome are required", code: "INVALID_PREVIEW" },
      { status: 400 },
    );
  }

  if (totalYesStake == null || totalNoStake == null) {
    return NextResponse.json(
      {
        kind: "projection",
        marketId,
        marketStatus: snapshotStatus,
        projectedWinningOutcome: outcome,
        projectedPayoutEffect: "Projected payout is unavailable for this market snapshot.",
        totalPool: null,
        warnings: ["Stake totals are missing or invalid, so payout effect cannot be projected."],
        marketRevision: marketRevision({
          status: snapshotStatus,
          totalYesStake: 0,
          totalNoStake: 0,
        }),
        source: "unavailable",
        available: false,
      } satisfies SettlementPreview,
      { status: 200 },
    );
  }

  let marketStatus = snapshotStatus;
  let source: SettlementPreview["source"] = "market-snapshot";

  try {
    const apiBase = resolveApiBase();
    const upstream = await fetch(
      `${apiBase}/resolution/market/${encodeURIComponent(marketId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      },
    );
    if (upstream.ok) {
      const body = (await upstream.json().catch(() => null)) as
        | { status?: string }
        | null;
      if (body && typeof body.status === "string" && body.status.trim()) {
        marketStatus = body.status;
        source = "backend";
      }
    }
  } catch (error) {
    if (error instanceof MissingApiBaseError) {
      // Keep the snapshot preview rather than failing the admin UI.
    }
  }

  const preview: SettlementPreview = {
    kind: "projection",
    marketId,
    marketStatus,
    projectedWinningOutcome: outcome,
    projectedPayoutEffect: describePayoutEffect({
      outcome,
      totalYesStake,
      totalNoStake,
    }),
    totalPool: totalYesStake + totalNoStake,
    warnings: previewWarnings(marketStatus, outcome),
    marketRevision: marketRevision({
      status: snapshotStatus,
      totalYesStake,
      totalNoStake,
    }),
    source,
    available: true,
  };

  return NextResponse.json(preview, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
