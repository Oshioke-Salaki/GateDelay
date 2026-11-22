/**
 * multisigAuth.test.ts
 *
 * #1195 – Verifies that resolveAuthenticatedActor enforces wallet-scoped
 * permission checks across propose, sign, and execute routes.
 */

/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ethers } from "ethers";
import {
  buildAuthProofMessage,
  resolveAuthenticatedActor,
} from "./multisigAuth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  url: string,
  headers: Record<string, string>,
): Request {
  return new Request(url, { method: "POST", headers });
}

// ---------------------------------------------------------------------------
// buildAuthProofMessage
// ---------------------------------------------------------------------------

describe("buildAuthProofMessage", () => {
  it("includes action and lowercased address", () => {
    const msg = buildAuthProofMessage(
      "execute",
      "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    );
    expect(msg).toMatch(/action: execute/);
    expect(msg).toMatch(/0xabcdef1234567890abcdef1234567890abcdef12/);
  });

  it("produces different messages for different actions (replay prevention)", () => {
    const addr = ethers.Wallet.createRandom().address;
    const propose = buildAuthProofMessage("propose", addr);
    const execute = buildAuthProofMessage("execute", addr);
    expect(propose).not.toBe(execute);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthenticatedActor — signed-request path
// ---------------------------------------------------------------------------

describe("resolveAuthenticatedActor — signed-request path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves actor from valid X-Multisig-Address + X-Multisig-Signature", async () => {
    const wallet = ethers.Wallet.createRandom();
    const action = "execute";
    const message = buildAuthProofMessage(action, wallet.address);
    const sig = await wallet.signMessage(message);

    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Address": wallet.address,
      "X-Multisig-Signature": sig,
    });

    const actor = await resolveAuthenticatedActor(req);
    expect(actor).toBe(wallet.address);
  });

  it("rejects when X-Multisig-Address is missing entirely", async () => {
    const req = makeRequest("http://localhost/api/multisig/execute", {});
    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });

  it("rejects an invalid address format in X-Multisig-Address", async () => {
    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Address": "not-an-address",
    });
    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });

  it("rejects when signature is missing (non-simulation mode)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "false");
    const addr = ethers.Wallet.createRandom().address;
    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Address": addr,
    });
    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });

  it("rejects a signature from the wrong key (impersonation attempt)", async () => {
    const victim = ethers.Wallet.createRandom();
    const attacker = ethers.Wallet.createRandom();

    const message = buildAuthProofMessage("execute", victim.address);
    const attackerSig = await attacker.signMessage(message);

    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Address": victim.address,
      "X-Multisig-Signature": attackerSig,
    });

    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });

  it("rejects a cross-action replay (propose sig used on execute route)", async () => {
    const wallet = ethers.Wallet.createRandom();
    // Sign for 'propose' but send to 'execute' route
    const message = buildAuthProofMessage("propose", wallet.address);
    const sig = await wallet.signMessage(message);

    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Address": wallet.address,
      "X-Multisig-Signature": sig,
    });

    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });

  it("allows address-only proof in simulation mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_MULTISIG_SIMULATE", "true");
    const addr = ethers.Wallet.createRandom().address;
    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Address": addr,
    });

    const actor = await resolveAuthenticatedActor(req);
    expect(actor).toBe(addr);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthenticatedActor — session token path
// ---------------------------------------------------------------------------

describe("resolveAuthenticatedActor — session token path", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function makeHmac(address: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(address),
    );
    return Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  it("resolves actor from valid session token", async () => {
    const secret = "test-session-secret";
    vi.stubEnv("MULTISIG_SESSION_SECRET", secret);

    const wallet = ethers.Wallet.createRandom();
    const hmac = await makeHmac(wallet.address, secret);
    const token = `${wallet.address}:${hmac}`;

    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Session": token,
    });

    const actor = await resolveAuthenticatedActor(req);
    expect(actor).toBe(wallet.address);
  });

  it("rejects a tampered session token", async () => {
    const secret = "test-session-secret";
    vi.stubEnv("MULTISIG_SESSION_SECRET", secret);

    const wallet = ethers.Wallet.createRandom();
    const differentAddr = ethers.Wallet.createRandom().address;
    const hmac = await makeHmac(wallet.address, secret);
    // Use a different address with the original HMAC
    const token = `${differentAddr}:${hmac}`;

    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Session": token,
    });

    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });

  it("rejects when MULTISIG_SESSION_SECRET is not configured", async () => {
    vi.stubEnv("MULTISIG_SESSION_SECRET", "");

    const req = makeRequest("http://localhost/api/multisig/execute", {
      "X-Multisig-Session": "0x1234567890123456789012345678901234567890:deadbeef",
    });

    await expect(resolveAuthenticatedActor(req)).rejects.toThrow(/AUTH/);
  });
});
