import { NextResponse } from "next/server";
import { getTransactionStatus } from "@/lib/multisigStore";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ txId: string }> }
) {
  try {
    const { txId } = await params;
    const status = getTransactionStatus(txId);
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
