import { NextResponse } from "next/server";
import { pinHash } from "@/lib/ipfsStore";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  try {
    const { hash } = await params;
    const { name } = await req.json().catch(() => ({}));
    await pinHash(hash, name);
    return NextResponse.json({ success: true, message: `Hash ${hash} pinned successfully` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message, code: "IPFS_ERROR" }, { status: 400 });
  }
}
