/**
 * ============================================================================
 * SECURITY BASELINE & THREAT BOUNDARY NOTES (Phase 2):
 *
 * 1. Admin & Role Isolation:
 *    To prevent mass-assignment vulnerabilities and horizontal privilege escalation,
 *    the User interface excludes any local role flags (e.g. `isAdmin`, `isOracle`).
 *    All administrative authorizations, role allocations, and multisig signers
 *    are validated on-chain via the RoleManager contract and managed by corresponding
 *    access guards, not derived from the user persistence schema.
 * 2. Secrets & Keys:
 *    User records never store keys, oracle operational secrets, or validator keys.
 * 3. Rate Limits & Guards:
 *    All sensitive or administrative actions targeting user records are protected
 *    by rate limits and identity verification guards.
 * ============================================================================
 */
export interface User {
  id: string;
  email: string;
  password?: string;
  name?: string;
  provider?: 'local' | 'google' | 'twitter';
  providerId?: string;
  refreshToken?: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
}
