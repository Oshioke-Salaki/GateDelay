import { NextResponse } from "next/server";
import { getWallet } from "@/lib/multisigStore";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ walletId: string }> }
) {
  try {
    const { walletId } = await params;
    const wallet = getWallet(walletId);
    return NextResponse.json({ success: true, data: wallet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
