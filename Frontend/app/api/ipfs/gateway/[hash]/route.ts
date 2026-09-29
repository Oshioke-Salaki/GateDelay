import { NextResponse } from "next/server";
import { getGatewayUrl, getStorageStatus } from "@/lib/ipfsStore";

/**
 * GET /api/ipfs/gateway/[hash]
 *
 * Resolves a gateway URL for an IPFS hash and reports the storage status for
 * that hash (from the in-memory `lib/ipfsStore` shim). The gateway base comes
 * from `NEXT_PUBLIC_IPFS_GATEWAY` (see `../.env.example`) or the public Pinata
 * gateway fallback.
 *
 * Every failure path returns structured JSON with a stable `code` so the app
 * shell can surface the reason instead of rendering a blank screen:
 * - VALIDATION_ERROR — missing/empty/malformed hash
 * - CONFIG_ERROR — gateway points at localhost in a production build
 * - INTERNAL_ERROR — unexpected runtime fault
 */

function hashError(message: string, code = "VALIDATION_ERROR") {
  return NextResponse.json(
    { success: false, error: message, code },
    { status: code === "VALIDATION_ERROR" ? 400 : 500 },
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  let hash: string;
  try {
    hash = (await params).hash;
  } catch {
    return hashError("Missing or malformed IPFS hash route parameter");
  }

  if (typeof hash !== "string" || hash.trim().length === 0) {
    return hashError("IPFS hash is required");
  }

  const trimmedHash = hash.trim();
  if (
    trimmedHash.length > 200 ||
    /\s/.test(trimmedHash) ||
    /[^A-Za-z0-9]/.test(trimmedHash)
  ) {
    return hashError("IPFS hash contains unsupported characters");
  }

  try {
    const status = getStorageStatus(trimmedHash);
    return NextResponse.json({
      success: true,
      data: { url: getGatewayUrl(trimmedHash), ...status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (/gateway|production|localhost/i.test(message)) {
      return hashError(message, "CONFIG_ERROR");
    }
    return hashError(message, "INTERNAL_ERROR");
  }
}
