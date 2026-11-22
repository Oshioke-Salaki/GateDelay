import { NextResponse } from "next/server";
import { processTransaction, type BroadcastReceipt } from "@/lib/multisigStore";
import { resolveAuthenticatedActor } from "@/lib/multisigAuth";

/**
 * POST /api/multisig/execute
 *
 * Body: `{ txId: string, receipt?: BroadcastReceipt }`
 *
 * #1195 – The executor identity is resolved exclusively from the authenticated
 *          session via `resolveAuthenticatedActor`.  Callers cannot supply an
 *          arbitrary `executor` field to impersonate another owner.
 *
 * #1196 – A `receipt` (txHash, blockNumber, status) from the chain broadcast
 *          is required in production.  In development/test environments the
 *          store's simulation path is available when
 *          `NEXT_PUBLIC_MULTISIG_SIMULATE=true`.
 *
 * Runs the multisig execute path and returns the transaction with contract
 * events mapped from `MultiSigWallet.sol` — specifically
 * `TransactionExecuted(txId, executor)` — so `MultisigUI` can render them
 * without inventing field names.
 */

export async function POST(req: Request) {
  // -------------------------------------------------------------------------
  // #1195 – Resolve actor from authenticated session
  // -------------------------------------------------------------------------
  let actor: string;
  try {
    actor = await resolveAuthenticatedActor(req);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Authentication required: provide a valid session token or signed request",
        code: "AUTH_ERROR",
      },
      { status: 401 },
    );
  }

  // -------------------------------------------------------------------------
  // Parse and validate request body
  // -------------------------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be valid JSON",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be a JSON object",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const { txId, receipt } = body as { txId?: unknown; receipt?: unknown };

  if (typeof txId !== "string" || !txId.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required field: txId",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  // Validate optional receipt shape when provided
  let validatedReceipt: BroadcastReceipt | undefined;
  if (receipt !== undefined) {
    if (
      !receipt ||
      typeof receipt !== "object" ||
      Array.isArray(receipt)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "receipt must be a JSON object when provided",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const r = receipt as Record<string, unknown>;
    if (typeof r.txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(r.txHash)) {
      return NextResponse.json(
        {
          success: false,
          error: "receipt.txHash must be a 32-byte hex string (0x + 64 hex chars)",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    if (!["mined", "confirmed", "failed"].includes(r.status as string)) {
      return NextResponse.json(
        {
          success: false,
          error: 'receipt.status must be "mined", "confirmed", or "failed"',
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    validatedReceipt = {
      txHash: r.txHash as string,
      status: r.status as BroadcastReceipt["status"],
      blockNumber:
        typeof r.blockNumber === "number" ? r.blockNumber : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Execute — actor comes from authenticated session, not the request body
  // -------------------------------------------------------------------------
  try {
    const result = await processTransaction(txId.trim(), actor, validatedReceipt);
    const executedEvent = [...result.events]
      .reverse()
      .find(
        (event) =>
          event.name === "TransactionExecuted" ||
          event.name === "TransactionRejected",
      );

    return NextResponse.json({
      success: true,
      data: result,
      // Explicit UI-facing projection of the contract event (also present on data.events).
      event: executedEvent ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Transaction not found"
        ? 404
        : message === "Transaction already executed" ||
            message.startsWith("Insufficient signatures") ||
            message.includes("not an owner")
          ? 400
          : message.startsWith("Authentication") || message.includes("AUTH")
            ? 401
            : 500;

    return NextResponse.json(
      { success: false, error: message, code: "MULTISIG_ERROR" },
      { status },
    );
  }
}
