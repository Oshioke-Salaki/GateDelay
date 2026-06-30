import { NextResponse } from "next/server";
import { processTransaction } from "@/lib/multisigStore";

export async function POST(req: Request) {
  try {
    const { txId } = await req.json();

    if (!txId) {
      return NextResponse.json(
        { success: false, error: "Missing required field: txId" },
        { status: 400 }
      );
    }

    const result = await processTransaction(txId);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
