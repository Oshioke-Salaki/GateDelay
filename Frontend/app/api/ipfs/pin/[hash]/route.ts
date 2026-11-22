import { NextResponse } from "next/server";
import { pinHash, getStorageStatus } from "@/lib/ipfsStore";

/**
 * POST /api/ipfs/pin/[hash]
 *
 * Requests provider-confirmed pinning for an already-uploaded IPFS hash.
 *
 * #1190 – `pinHash` now follows the full provider lifecycle:
 *   requested → pending → pinned | failed
 * The response reflects the provider-confirmed state, not an optimistic local
 * write. `data.pinned` is `true` only when the provider confirmed the pin.
 *
 * Optional JSON body: `{ name?: string }` — a pin label forwarded to the
 * provider. An empty body is valid because the name is optional.
 *
 * Error codes:
 * - VALIDATION_ERROR — missing/empty/malformed hash or invalid body
 * - NOT_FOUND — hash is not in the store (upload first)
 * - PIN_FAILED — provider rejected or timed out; see `data.pinStatus`
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
    // pinHash throws if the hash is not found; returns false if provider fails
    const confirmed = await pinHash(trimmedHash, name);

    if (!confirmed) {
      // Provider rejected or timed out — fetch persisted status for details
      const status = await getStorageStatus(trimmedHash);
      return NextResponse.json(
        {
          success: false,
          error: "Provider could not confirm the pin",
          code: "PIN_FAILED",
          data: {
            hash: trimmedHash,
            pinned: false,
            pinStatus: status.pinStatus,
            pinRetries: status.pinRetries,
            pinError: status.pinError,
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Hash ${trimmedHash} pinned successfully`,
      data: { hash: trimmedHash, pinned: true, pinStatus: "pinned" },
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
