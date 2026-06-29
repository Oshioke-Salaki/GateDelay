import { NextResponse } from "next/server";
import { collectSignature } from "@/lib/multisigStore";

export async function POST(req: Request) {
  try {
    const { txId, owner, signature } = await req.json();

    if (!txId || !owner || !signature) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: txId, owner, signature" },
        { status: 400 }
      );
    }

    const result = await collectSignature(txId, owner, signature);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
