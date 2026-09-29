import { NextResponse } from "next/server";
import { uploadJSON, getGatewayUrl } from "@/lib/ipfsStore";

/**
 * POST /api/ipfs/upload-json
 *
 * Body: `{ data: object, metadata?: { name?: string } }`
 *
 * Stores JSON via the in-memory IPFS shim (`lib/ipfsStore`) that mirrors
 * Backend/services/ipfsService.js. Gateway URLs come from
 * `NEXT_PUBLIC_IPFS_GATEWAY` (see `.env.example`) — never a hard-coded
 * localhost production default.
 *
 * Error codes:
 * - VALIDATION_ERROR — missing/invalid body
 * - CONFIG_ERROR — gateway misconfiguration (should not happen with defaults)
 * - IPFS_ERROR — storage failure
 * - INTERNAL_ERROR — unexpected runtime fault
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

  if (!isPlainObject(body)) {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be a JSON object",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const { data, metadata } = body as {
    data?: unknown;
    metadata?: { name?: unknown };
  };

  if (data === undefined || data === null) {
    return NextResponse.json(
      {
        success: false,
        error: "Data object is required",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  if (typeof data !== "object") {
    return NextResponse.json(
      {
        success: false,
        error: "Data must be a JSON object or array",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  const name =
    metadata && typeof metadata === "object" && typeof metadata.name === "string"
      ? metadata.name
      : undefined;

  try {
    const hash = await uploadJSON(data, { name });
    let url: string;
    try {
      url = getGatewayUrl(hash);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "IPFS gateway is not configured",
          code: "CONFIG_ERROR",
        },
        { status: 500 },
      );
    }

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "IPFS gateway returned a malformed URL",
          code: "UPSTREAM_ERROR",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { hash, url },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message, code: "IPFS_ERROR" },
      { status: 400 },
    );
  }
}
