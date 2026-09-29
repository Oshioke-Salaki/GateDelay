# Auth DTO security review

Review scope: `auth.dto.ts`, its global validation boundary, and the auth
controller rate-limit metadata.

## Threat notes

- **Mass assignment:** the global `ValidationPipe` uses `whitelist` and
  `forbidNonWhitelisted`, so fields such as `isAdmin` are rejected rather than
  copied into auth service input.
- **Injection-shaped input:** emails and provider values are typed and bounded;
  names reject control characters; passwords and opaque tokens are not parsed
  or interpolated by the DTO. Auth service consumers must continue using
  parameterized persistence and context-specific output escaping.
- **Secret leakage:** passwords and tokens are never included in DTO error
  messages. The global pipe disables `target` and `value` in validation errors,
  preventing rejected secret values from being serialized in API responses.
- **Brute force and reset abuse:** `AuthController` is marked with the
  `auth` rate-limit tier (10 requests per minute). This is an in-memory,
  process-local limiter; production deployments with multiple instances need a
  shared store and monitoring before relying on it for abuse prevention.

## Review result

No critical findings remain in the DTO validation boundary. Negative-path tests
cover blank credentials, control-character names, and mass-assignment fields.
The social-token verifier and reset-email implementation remain service-layer
responsibilities and require separate production reviews before beta.

## Auth service beta gate

- `AuthService` contains no private keys or literal credentials; JWT and SMTP
  secrets are read from `ConfigService`.
- Negative-path service tests cover duplicate registration, generic login
  failures, reset-token expiry and one-time use, refresh-token replay after
  rotation, and logout invalidation.
- The current in-memory user/session/reset-token store is not suitable for
  multi-instance production. Before beta, move these records to durable,
  shared storage and make refresh-token rotation atomic to close concurrent
  replay races.
- Logout revokes the refresh token only; already-issued access tokens remain
  valid until expiry. Configure short access-token lifetimes and document this
  behavior for incident response.
- `forgotPassword` uses a uniform response, but production delivery should
  account for timing differences and avoid exposing reset tokens through URL,
  proxy, browser-history, or referrer logs.