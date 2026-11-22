import { NextResponse } from "next/server";
import { proposeTransaction } from "@/lib/multisigStore";
import { resolveAuthenticatedActor } from "@/lib/multisigAuth";

/**
 * POST /api/multisig/propose
 *
 * Body: `{ walletId: string, txData: Record<string, unknown> }`
 *
 * #1195 – The proposer identity is resolved exclusively from the authenticated
 *          session via `resolveAuthenticatedActor`.  Callers cannot supply an
 *          arbitrary `proposer` field to impersonate another owner.
 *
 * Creates a pending multisig transaction proposal. Follows the same structured
 * error pattern as the execute route so the UI can map error codes to
 * user-facing messages instead of rendering blank screens.
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

  const { walletId, txData } = body as {
    walletId?: unknown;
    txData?: unknown;
  };

  const missing: string[] = [];
  if (!walletId) missing.push("walletId");
  if (!txData) missing.push("txData");

  if (missing.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Missing required fields: ${missing.join(", ")}`,
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  if (typeof txData !== "object" || Array.isArray(txData)) {
    return NextResponse.json(
      {
        success: false,
        error: "txData must be a JSON object",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  try {
    const txId = await proposeTransaction(
      walletId as string,
      txData as Record<string, unknown>,
      actor, // actor from authenticated session, not request body
    );
    return NextResponse.json({ success: true, data: { txId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    const status =
      message === "Multisig wallet not found" ||
      message.includes("No multisig wallets are configured")
        ? 404
        : message.includes("not an owner")
          ? 403
          : 400;

    return NextResponse.json(
      { success: false, error: message, code: "MULTISIG_ERROR" },
      { status },
    );
  }
}
