/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import {
  __resetMultisigStoreForTests,
  __setMultisigWalletsForTests,
  type MultisigWallet,
} from "@/lib/multisigStore";
import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OWNER_KEY = ethers.Wallet.createRandom();
const NON_OWNER_KEY = ethers.Wallet.createRandom();

const TEST_WALLET: MultisigWallet = {
  address: "0x0000000000000000000000000000000000000099",
  owners: [OWNER_KEY.address],
  threshold: 1,
  scheme: "ECDSA",
};

/** Build an authenticated request (simulation mode — no sig required). */
function jsonBody(body: unknown, address?: string) {
  return new Request("http://localhost/api/multisig/propose", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(address ? { "X-Multisig-Address": address } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/multisig/propose", () => {
  beforeEach(() => {
    __setMultisigWalletsForTests({ TEST_WALLET: TEST_WALLET });
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
  });

  afterEach(() => {
    __resetMultisigStoreForTests();
    vi.unstubAllEnvs();
  });

  it("returns txId on happy path", async () => {
    const res = await POST(
      jsonBody(
        { walletId: "TEST_WALLET", txData: { target: TEST_WALLET.address, value: "0", data: "0x" } },
        OWNER_KEY.address,
      ),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.txId).toMatch(/^tx_/);
  });

  it("returns 401 when no authentication headers are present", async () => {
    const res = await POST(
      jsonBody({ walletId: "TEST_WALLET", txData: { target: "0x0" } }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("AUTH_ERROR");
  });

  it("returns 403 when the authenticated actor is not an owner", async () => {
    const res = await POST(
      jsonBody(
        { walletId: "TEST_WALLET", txData: { target: "0x0" } },
        NON_OWNER_KEY.address,
      ),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 404 for unknown wallet", async () => {
    const res = await POST(
      jsonBody(
        { walletId: "NONEXISTENT", txData: { target: "0x0" } },
        OWNER_KEY.address,
      ),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("MULTISIG_ERROR");
  });

  it("rejects missing fields with clear validation error", async () => {
    const res = await POST(jsonBody({}, OWNER_KEY.address));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed JSON without throwing", async () => {
    const res = await POST(
      new Request("http://localhost/api/multisig/propose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Multisig-Address": OWNER_KEY.address,
        },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects non-object txData", async () => {
    const res = await POST(
      jsonBody(
        { walletId: "TEST_WALLET", txData: "not-an-object" },
        OWNER_KEY.address,
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});
