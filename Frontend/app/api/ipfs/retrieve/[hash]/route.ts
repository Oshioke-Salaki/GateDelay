import { NextResponse } from "next/server";
import { retrieve, getGatewayUrl } from "@/lib/ipfsStore";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const data = await retrieve(hash);
    return NextResponse.json({
      success: true,
      data,
      url: getGatewayUrl(hash),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message, code: "IPFS_ERROR" }, { status: 400 });
  }
}
