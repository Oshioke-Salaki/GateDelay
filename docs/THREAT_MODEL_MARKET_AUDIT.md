# Market Audit Threat Notes

The `/api/market-audit/*` surface is an administrative audit interface. It must not be treated as a public telemetry endpoint.

## Mitigations in this change

- Every route uses the existing `JwtAuthGuard`; unauthenticated requests are rejected before the controller executes.
- The controller applies the existing `admin` rate-limit tier. The rate-limit guard runs globally, so read, write, retention, report, and integrity routes share an explicit tier instead of inheriting an accidental default.
- The authenticated JWT subject is used as the audit actor. A request body cannot impersonate another actor.
- `MARKET_AUDIT_ADMIN_IDS` is a fail-closed allowlist for all audit routes; a valid JWT alone is insufficient.
- DTO validation bounds identifiers, operations, dates, retention periods, and result counts. The global validation pipe rejects unknown properties.
- The service redacts bearer tokens, API/access/refresh/private keys, passwords, secrets, and 32-byte hexadecimal secrets before storing or hashing details.
- Audit query filters are passed as structured values to the in-memory service; no query string is evaluated as code or used to construct a database expression.

## Residual requirements

- JWT signing secrets must be configured in deployment; the existing auth module must not run with an empty production secret.
- The allowlist is deployment configuration rather than a persistent role system. Keep it managed as a protected secret/configuration value and replace it with the platform identity/role directory when one exists.
- The in-memory rate limiter is process-local. Multi-instance deployments must replace it with the existing Redis-backed cache/rate-limit store or enforce equivalent edge rate limits. The guard uses Express `req.ip`/socket identity and does not trust an arbitrary `X-Forwarded-For` header; proxy trust must be configured deliberately at the edge.
- Do not put secrets in audit `details`; redaction is defense in depth, not a credential storage policy.
- Log export and frontend proxy routes must preserve bearer authentication and must not cache administrative responses publicly.
