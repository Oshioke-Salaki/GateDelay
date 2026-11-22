# Market Audit Controller Threat Model

## Scope

`MarketAuditController` exposes append-only audit writes, filtered reads, retention enforcement, summary reports, and integrity checks.

## Review outcome

**Status: no critical findings.** The controller is protected by `JwtAuthGuard` and the global rate limiter. Request DTOs are validated by the global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` enabled.

## Threats and controls

| Threat | Control |
| --- | --- |
| Unauthenticated audit writes or disclosure | `@UseGuards(JwtAuthGuard)` is applied at controller scope. |
| Audit flooding or expensive report/integrity calls | `@RateLimit('standard')` applies the 100 requests/minute tier. |
| Mass assignment | Global validation whitelists DTO properties and rejects unknown fields. |
| Query/date injection or invalid ranges | `AuditQueryDto` and the private report query DTO require strict ISO-8601 dates and bounded query limits. |
| CSV/control-character injection | Audit DTOs reject control characters, formula-prefixed details, and credential-shaped content. |
| Accidental destructive retention calls | Retention is POST-only, authenticated, and accepts a bounded `RetentionPolicyDto`. |
| Secret leakage | Controller contains no credentials; audit details are rejected by `ContainsNoSecrets`. |

## Negative-path coverage

`market-audit.controller.spec.ts` verifies guard and rate-limit metadata and ensures optional retention values do not mutate policy. DTO and service tests cover malformed dates, unknown fields, control characters, formula prefixes, oversized values, and secret-shaped input.
