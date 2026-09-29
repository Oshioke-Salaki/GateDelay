import { NextResponse } from "next/server";
import { processTransaction } from "@/lib/multisigStore";

/**
 * POST /api/multisig/execute
 *
 * Body: `{ txId: string, executor?: string }`
 *
 * Runs the in-memory multisig execute path and returns the transaction with
 * contract events mapped from `MultiSigWallet.sol` — specifically
 * `TransactionExecuted(txId, executor)` — so `MultisigUI` can render them
 * without inventing field names.
 */

export async function POST(req: Request) {
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

  const { txId, executor } = body as { txId?: unknown; executor?: unknown };

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

  if (executor !== undefined && typeof executor !== "string") {
    return NextResponse.json(
      {
        success: false,
        error: "executor must be a string address when provided",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  try {
    const result = await processTransaction(txId.trim(), executor?.trim());
    const executedEvent = [...result.events]
      .reverse()
      .find((event) => event.name === "TransactionExecuted");

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
          : 500;

    return NextResponse.json(
      { success: false, error: message, code: "MULTISIG_ERROR" },
      { status },
    );
  }
}
