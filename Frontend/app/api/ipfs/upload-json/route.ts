import { NextResponse } from "next/server";
import { uploadJSON, getGatewayUrl } from "@/lib/ipfsStore";

export async function POST(req: Request) {
  try {
    const { data, metadata } = await req.json();

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Data object is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const hash = await uploadJSON(data, { name: metadata?.name });
    return NextResponse.json({
      success: true,
      data: { hash, url: getGatewayUrl(hash) },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message, code: "IPFS_ERROR" }, { status: 400 });
  }
}
