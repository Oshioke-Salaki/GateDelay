import { NextResponse } from "next/server";
import { getGatewayUrl, getStorageStatus } from "@/lib/ipfsStore";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const status = getStorageStatus(hash);
  return NextResponse.json({
    success: true,
    data: { url: getGatewayUrl(hash), ...status },
  });
}
