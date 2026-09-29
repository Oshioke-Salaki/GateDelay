/**
 * Resolves backend origin URLs for server-side route handlers and the
 * WebSocket provider.
 *
 * Route handlers across `app/api/*` each inlined
 * `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"`. That default
 * is convenient locally and wrong everywhere else: a deployment that forgets to
 * set the variable does not fail, it silently points production traffic at a
 * loopback address that is not listening, and the UI shows an empty page rather
 * than an error.
 *
 * This keeps the zero-config local default but makes the production path refuse
 * to guess.
 */

/** Local default. Matches `PORT=4000` in `Backend/.env.example`. */
const DEVELOPMENT_API_FALLBACK = "http://localhost:4000/api";
const DEVELOPMENT_BACKEND_FALLBACK = "http://localhost:4000";

export class MissingApiBaseError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_API_URL is not set. It is required in production builds — " +
        "there is no safe default, so requests would otherwise be sent to " +
        "localhost. See Frontend/.env.example.",
    );
    this.name = "MissingApiBaseError";
  }
}

export class MissingBackendUrlError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_BACKEND_URL is not set. It is required in production builds — " +
        "there is no safe default for the WebSocket / socket.io origin. " +
        "See Frontend/.env.example.",
    );
    this.name = "MissingBackendUrlError";
  }
}

/**
 * @returns the API base with any trailing slash removed.
 * @throws {MissingApiBaseError} in production when the variable is unset.
 */
export function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new MissingApiBaseError();
  }

  return DEVELOPMENT_API_FALLBACK;
}

/**
 * Backend origin used by socket.io (`WebSocketProvider`) and other direct
 * browser→backend calls. Distinct from `resolveApiBase()` which includes the
 * `/api` prefix.
 *
 * @throws {MissingBackendUrlError} in production when the variable is unset.
 */
export function resolveBackendUrl(): string {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new MissingBackendUrlError();
  }

  return DEVELOPMENT_BACKEND_FALLBACK;
}
