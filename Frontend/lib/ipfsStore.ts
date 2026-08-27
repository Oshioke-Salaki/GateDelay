/**
 * In-memory IPFS store for Next.js API routes.
 * Mirrors Backend/services/ipfsService.js for frontend integration.
 */

/** Public Pinata gateway — never a localhost production default. */
const FALLBACK_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

const storage = new Map<string, unknown>();
const pinnedHashes = new Set<string>();

function resolveGatewayBase(): string {
  const configured = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim();
  if (configured) {
    const base = configured.endsWith("/") ? configured : `${configured}/`;
    if (
      process.env.NODE_ENV === "production" &&
      /localhost|127\.0\.0\.1/i.test(base)
    ) {
      throw new Error(
        "NEXT_PUBLIC_IPFS_GATEWAY points at localhost in a production build. " +
          "Set it to a public gateway (see Frontend/.env.example).",
      );
    }
    return base;
  }
  return FALLBACK_GATEWAY;
}

function generateHash(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz234567";
  let hash = "Qm";
  for (let i = 0; i < 44; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

export async function uploadJSON(
  data: unknown,
  options: { name?: string } = {}
): Promise<string> {
  const hash = generateHash();
  storage.set(hash, { data, metadata: { name: options.name, uploadedAt: new Date().toISOString() } });
  pinnedHashes.add(hash);
  return hash;
}

export async function uploadFile(
  content: string,
  fileName: string
): Promise<string> {
  const hash = generateHash();
  storage.set(hash, { content, fileName, uploadedAt: new Date().toISOString() });
  pinnedHashes.add(hash);
  return hash;
}

export async function retrieve(hash: string): Promise<unknown> {
  const entry = storage.get(hash);
  if (!entry) throw new Error(`Failed to retrieve data from IPFS: hash ${hash} not found`);
  if (typeof entry === "object" && entry !== null && "data" in entry) {
    return (entry as { data: unknown }).data;
  }
  return entry;
}

export async function pinHash(hash: string, name?: string): Promise<boolean> {
  if (!storage.has(hash)) throw new Error(`Hash ${hash} not found`);
  pinnedHashes.add(hash);
  if (name) {
    const entry = storage.get(hash);
    if (typeof entry === "object" && entry !== null) {
      (entry as Record<string, unknown>).pinName = name;
    }
  }
  return true;
}

export function getGatewayUrl(hash: string): string {
  if (!hash || typeof hash !== "string") {
    throw new Error("IPFS hash is required to build a gateway URL");
  }
  return `${resolveGatewayBase()}${hash}`;
}

export function getStorageStatus(hash: string): {
  stored: boolean;
  pinned: boolean;
  gatewayUrl: string;
} {
  return {
    stored: storage.has(hash),
    pinned: pinnedHashes.has(hash),
    gatewayUrl: getGatewayUrl(hash),
  };
}
