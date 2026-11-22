export function maskApiKey(secret?: string | null, prefix?: string | null): string {
  if (prefix && prefix.trim()) {
    return `${prefix.trim()}${"•".repeat(14)}`;
  }
  if (!secret) {
    return "gdk_••••••••••••••••";
  }
  const head = secret.startsWith("gdk_") ? secret.slice(0, 8) : secret.slice(0, 4);
  return `${head}${"•".repeat(16)}`;
}

export const API_KEY_SCOPE_COPY =
  "Each key is limited to the scopes granted at creation. Typical keys use read for market data and write for authenticated trading actions. A revoked key cannot call either scope.";
