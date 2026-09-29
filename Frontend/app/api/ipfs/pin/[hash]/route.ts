import { NextResponse } from "next/server";
import { pinHash } from "@/lib/ipfsStore";

/**
 * POST /api/ipfs/pin/[hash]
 *
 * Pins an already-uploaded IPFS hash in the in-memory `lib/ipfsStore` shim
 * that mirrors Backend/services/ipfsService.js. Called by `useIPFS.pin` from
 * `MarketIPFSPanel` on `/markets/create` after a successful upload.
 *
 * Optional JSON body: `{ name?: string }` — a pin label stored alongside the
 * hash. An empty body is valid because the name is optional.
 *
 * This is an API route, not a UI page. It never renders layout or CSS.
 * Wallet connect and navbar come from `app/layout.tsx`; this handler mounts
 * no chrome of its own.
 *
 * Every failure path returns structured JSON with a stable `code` so the app
 * shell can surface the reason instead of a blank screen:
 * - VALIDATION_ERROR — missing/empty/malformed hash or invalid body
 * - NOT_FOUND — hash is not in the in-memory store (upload first)
 * - INTERNAL_ERROR — unexpected runtime fault
 */

function jsonError(message: string, code: string, status: number) {
  return NextResponse.json({ success: false, error: message, code }, { status });
}

function isSupportedHash(hash: string): boolean {
  return (
    hash.length > 0 &&
    hash.length <= 200 &&
    !/\s/.test(hash) &&
    !/[^A-Za-z0-9]/.test(hash)
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  let hash: string;
  try {
    hash = (await params).hash;
  } catch {
    return jsonError(
      "Missing or malformed IPFS hash route parameter",
      "VALIDATION_ERROR",
      400,
    );
  }

  if (typeof hash !== "string" || hash.trim().length === 0) {
    return jsonError("IPFS hash is required", "VALIDATION_ERROR", 400);
  }

  const trimmedHash = hash.trim();
  if (!isSupportedHash(trimmedHash)) {
    return jsonError(
      "IPFS hash contains unsupported characters",
      "VALIDATION_ERROR",
      400,
    );
  }

  let name: string | undefined;
  const raw = await req.text();
  if (raw.trim().length > 0) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(
        "Request body must be valid JSON when provided",
        "VALIDATION_ERROR",
        400,
      );
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(
        "Request body must be a JSON object when provided",
        "VALIDATION_ERROR",
        400,
      );
    }

    const rawName = (body as { name?: unknown }).name;
    if (rawName !== undefined && rawName !== null) {
      if (typeof rawName !== "string") {
        return jsonError(
          "Pin name must be a string when provided",
          "VALIDATION_ERROR",
          400,
        );
      }
      name = rawName;
    }
  }

  try {
    await pinHash(trimmedHash, name);
    return NextResponse.json({
      success: true,
      message: `Hash ${trimmedHash} pinned successfully`,
      data: { hash: trimmedHash, pinned: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (/not found/i.test(message)) {
      return jsonError(
        `Hash ${trimmedHash} not found. Upload the content first via POST /api/ipfs/upload-json.`,
        "NOT_FOUND",
        404,
      );
    }
    return jsonError(message, "INTERNAL_ERROR", 500);
  }
}
