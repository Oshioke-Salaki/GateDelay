import { NextResponse } from "next/server";
import { collectSignature } from "@/lib/multisigStore";
import { resolveAuthenticatedActor } from "@/lib/multisigAuth";

/**
 * POST /api/multisig/sign
 *
 * Body: `{ txId: string, signature: string }`
 *
 * #1194 – `collectSignature` verifies the supplied signature cryptographically
 *          against the canonical transaction digest before accepting approval.
 *          Wrong-key, malformed, and altered-payload signatures are rejected.
 *
 * #1195 – The signer identity is resolved exclusively from the authenticated
 *          session via `resolveAuthenticatedActor`.  The `owner` field in the
 *          request body is no longer accepted; the store will verify the
 *          signature against the authenticated address directly.
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

  const { txId, signature } = body as { txId?: unknown; signature?: unknown };

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

  if (typeof signature !== "string" || !signature.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required field: signature",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  try {
    // owner is the authenticated actor — not a caller-supplied string
    const result = await collectSignature(txId.trim(), actor, signature.trim());
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Transaction not found"
        ? 404
        : message.includes("not an owner") ||
            message.startsWith("Signature verification failed") ||
            message.startsWith("Invalid signature format") ||
            message.startsWith("Signature recovery failed")
          ? 403
          : message.includes("already signed")
            ? 409
            : 400;

    return NextResponse.json(
      { success: false, error: message, code: "MULTISIG_ERROR" },
      { status },
    );
  }
}
