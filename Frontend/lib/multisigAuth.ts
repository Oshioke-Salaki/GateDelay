/**
 * multisigAuth.ts
 *
 * #1195 – Resolve the authenticated actor identity for multisig API routes.
 *
 * Actor identity is established through one of two mechanisms (in priority order):
 *
 *   1. **Signed-request proof** — The caller supplies an `X-Multisig-Address`
 *      header containing the claimed Ethereum address and an
 *      `X-Multisig-Signature` header containing a personal_sign signature over
 *      the canonical request proof message.  The server recovers the signer and
 *      confirms it matches the claimed address.
 *
 *   2. **Session token** — The caller supplies a `X-Multisig-Session` header
 *      whose value was previously issued by the authentication layer.  This path
 *      is a stub that projects that integrate an auth backend (e.g. NextAuth,
 *      Particle session) should replace with a real token verification call.
 *
 * Design notes:
 *   - No actor can be supplied via the request body; this prevents impersonation
 *     by substituting an `executor` or `owner` field.
 *   - Both mechanisms reject requests with no proof, leaving the transaction
 *     store unchanged.
 *   - `NEXT_PUBLIC_MULTISIG_SIMULATE=true` AND `NODE_ENV !== "production"` allows
 *     passing `X-Multisig-Address` without a signature for local development.
 *     This escape hatch is explicitly documented and disabled in production.
 */

import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Proof message
// ---------------------------------------------------------------------------

/**
 * The canonical message an owner must sign to prove control of their address
 * for a specific route action.  Including the action prevents cross-endpoint
 * replay: a `propose` proof cannot be replayed on the `execute` route.
 *
 * @param action   One of "propose" | "sign" | "execute"
 * @param address  The Ethereum address of the claimant (checksummed or lower)
 */
export function buildAuthProofMessage(action: string, address: string): string {
  return `GateDelay multisig auth\naction: ${action}\naddress: ${address.toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Actor resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the authenticated actor Ethereum address from the incoming request.
 *
 * Throws if:
 *   - No authentication headers are present.
 *   - The claimed address is not a valid Ethereum address.
 *   - The supplied signature does not recover to the claimed address.
 *   - A session token is present but fails verification.
 *
 * Returns the checksummed Ethereum address of the authenticated actor.
 */
export async function resolveAuthenticatedActor(req: Request): Promise<string> {
  const claimedAddress = req.headers.get("x-multisig-address");
  const signatureHeader = req.headers.get("x-multisig-signature");
  const sessionToken = req.headers.get("x-multisig-session");

  // ------------------------------------------------------------------
  // Path 1: signed-request proof
  // ------------------------------------------------------------------
  if (claimedAddress) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(claimedAddress)) {
      throw new Error(
        `AUTH: X-Multisig-Address "${claimedAddress}" is not a valid Ethereum address`,
      );
    }

    // Simulation escape hatch — dev / test only.
    const simulate =
      process.env.NEXT_PUBLIC_MULTISIG_SIMULATE === "true" &&
      process.env.NODE_ENV !== "production";

    if (simulate && !signatureHeader) {
      // No signature required in simulation mode; return as-is.
      return claimedAddress;
    }

    if (!signatureHeader) {
      throw new Error(
        "AUTH: X-Multisig-Address provided without X-Multisig-Signature",
      );
    }

    if (!/^0x[0-9a-fA-F]{130}$/.test(signatureHeader)) {
      throw new Error(
        "AUTH: X-Multisig-Signature must be a 65-byte (130 hex char) EIP-191 signature",
      );
    }

    // Derive action from URL path for cross-endpoint replay prevention.
    const action = deriveActionFromUrl(req.url);
    const message = buildAuthProofMessage(action, claimedAddress);

    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signatureHeader);
    } catch {
      throw new Error("AUTH: Signature recovery failed for the provided proof");
    }

    if (recovered.toLowerCase() !== claimedAddress.toLowerCase()) {
      throw new Error(
        `AUTH: Signature mismatch — recovered ${recovered}, expected ${claimedAddress}`,
      );
    }

    return claimedAddress;
  }

  // ------------------------------------------------------------------
  // Path 2: session token
  // ------------------------------------------------------------------
  if (sessionToken) {
    return verifySessionToken(sessionToken);
  }

  // ------------------------------------------------------------------
  // No credentials
  // ------------------------------------------------------------------
  throw new Error(
    "AUTH: No authentication credentials. Provide X-Multisig-Address + X-Multisig-Signature or X-Multisig-Session.",
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the multisig action from the request URL path.
 * Falls back to "unknown" so the proof message is always well-formed.
 */
function deriveActionFromUrl(url: string): string {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/api\/multisig\/([^/]+)/);
    return match ? match[1] : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Verify a session token and return the associated Ethereum address.
 *
 * This is a stub that projects should replace with their auth backend
 * (e.g. `getServerSession` from NextAuth, Particle session verification).
 *
 * The stub accepts tokens in the format `<address>:<hmac>` where `hmac` is
 * HMAC-SHA256(address, SESSION_SECRET).  This is intentionally simple to keep
 * the implementation dependency-free while providing a testable interface.
 */
async function verifySessionToken(token: string): Promise<string> {
  const secret = process.env.MULTISIG_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH: Session token provided but MULTISIG_SESSION_SECRET is not configured",
    );
  }

  const parts = token.split(":");
  if (parts.length !== 2) {
    throw new Error("AUTH: Malformed session token");
  }

  const [address, hmac] = parts;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("AUTH: Session token contains an invalid Ethereum address");
  }

  // Node.js crypto (available in Next.js API routes via the Web Crypto API).
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const sigBytes = hexToBytes(hmac);
  const dataBytes = encoder.encode(address);
  const valid = await crypto.subtle.verify("HMAC", keyMaterial, new Uint8Array(sigBytes).buffer, dataBytes);

  if (!valid) {
    throw new Error("AUTH: Session token signature is invalid");
  }

  return address;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("AUTH: Hex string has odd length");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
