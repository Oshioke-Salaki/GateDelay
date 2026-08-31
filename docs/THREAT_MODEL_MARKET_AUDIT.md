# Threat model — market audit trail

Scope: `Backend/src/market-audit/` (DTOs, controller, service) and the consumers
that render its output — `Frontend/app/api/market-audit/route.ts` and
`Frontend/components/audit/AuditLogViewer.tsx`.

Companion to [`docs/THREAT_MODEL_BLACKLIST.md`](THREAT_MODEL_BLACKLIST.md).
Source of the numbering: the table in `Backend/src/market-audit/dto/market-audit.dto.ts`.
Negative-path coverage: `Backend/src/market-audit/dto/market-audit.dto.spec.ts`.

## What makes this subsystem different

`MarketAuditService` is an **append-only hash chain**. Every record stores the
previous record's SHA-256 and `verifyIntegrity()` re-walks the chain from
`GENESIS`. Two properties follow, and they set the whole design:

1. **Writes are irreversible.** Deleting or editing record *n* invalidates the
   hash of every record after it. There is no "redact this one field" operation.
   A bad value admitted at the DTO is permanent until the chain is rebuilt.
2. **Reads happen far from writes.** The same strings are re-serialised into a
   JSON API, a paginated table, and a CSV download opened in desktop
   spreadsheets. Sanitising at render time means sanitising in three places;
   sanitising at the DTO means doing it once.

So the DTO is the trust boundary. Everything below is enforced there, before the
value can reach `createLog()`.

## Assets

| Asset | Why it matters |
|---|---|
| Chain integrity (`hash` / `previousHash`) | The only evidence that history was not rewritten |
| Record contents | Feed compliance exports and incident review |
| Backend availability | An unbounded write path is a cheap memory DoS — logs are held in process memory |
| Operator credentials | Must never enter a store that cannot be redacted |

## Trust boundaries

```
browser ──► Next route handler ──► Nest controller ──► DTO gate ──► MarketAuditService
            (app/api/market-audit)  (@Body/@Query)     ◄── enforced here
```

The Next.js route handler is a **proxy, not a control**: it forwards filters
straight through, and anything that can reach the backend directly bypasses it
entirely. Treat every field as attacker-controlled at the Nest boundary.

## Threats and controls

### 1. Credential exfiltration through the audit trail

*Attack:* a caller writes a deployer key, a `PRIVATE_KEY` from
`Backend/.env.example`, or a session JWT into `details` — by accident (pasting a
stack trace) or deliberately. The audit log becomes a credential store that
cannot be redacted without breaking the chain, and the value is then copied into
every CSV export.

*Control:* `@ContainsNoSecrets()` in `dto/no-secrets.validator.ts` rejects EVM
private keys (0x-prefixed and bare 64-hex), PEM blocks, JWTs, AWS access key ids,
vendor-prefixed tokens (GitHub/Stripe/Slack/Groq), `secret=…`-style assignments,
and bare 12/24-word BIP-39 mnemonics. The rejection message deliberately does
**not** echo the offending value — an error response is one more log line.

*Residual risk:* this is a guard rail, not a scanner. Base64, split, or
otherwise encoded secrets pass. Rotate any credential believed to have been
written, rather than trusting the filter.

### 2. Log flooding and memory amplification

*Attack:* megabyte `details` values, or `?limit=10000000`, to exhaust process
memory — `MarketAuditService.logs` is an in-process array with no backing store.

*Control:* `@MaxLength` on every string (2 KiB on `details`, 128/64 on
identifiers), and `limit` bounded by `MAX_QUERY_LIMIT` (1000). `queryLogs`
already defaults to 100 when unset.

*Residual risk:* no per-caller rate limit on `POST /market-audit/logs`. The
project depends on `@nestjs/throttler`; applying it to this controller is the
follow-up.

### 3. Log forging / line spoofing

*Attack:* embed `\n` or `\r` in `details` or `actor` so a downstream line-oriented
consumer (log shipper, `grep`, CSV row splitter) reads one record as two, and the
injected half looks like a genuine `CRITICAL` entry.

*Control:* identifiers are restricted to `^[A-Za-z0-9][A-Za-z0-9._:-]*$`, and
`details` rejects the entire ASCII control range via `NO_CONTROL_CHARS`.

### 4. CSV formula injection

*Attack:* `details` beginning with `=`, `+`, `-` or `@`. `exportCSV()` in
`AuditLogViewer.tsx` quotes and doubles `"`, which is correct CSV — but Excel,
LibreOffice and Sheets still evaluate a leading sigil as a formula when the file
is opened, reaching `HYPERLINK`, `WEBSERVICE` or DDE.

*Control:* `NOT_A_FORMULA` rejects those four leading characters. A sigil
anywhere else in the string is allowed, so `delta +0.2%` still works.

### 5. Query-parameter type confusion

*Attack / defect:* query strings always arrive as text. The previous DTO used a
bare `@IsNumber()` while `main.ts` runs `ValidationPipe` **without**
`transform: true`, so `?limit=50` was validated as the string `"50"` and every
paged request returned `400`. That is a self-inflicted denial of the audit view
— the frontend calls `/api/market-audit?limit=2000` on load.

*Control:* `@Type(() => Number)` plus `@IsInt`, `@Min(1)` and `@Max`. The
controller no longer re-parses with `Number(...)`; the DTO is the single source
of truth for the type.

### 6. Irreversible retention wipe

*Attack:* `POST /market-audit/retention` with `retentionDays: 0` (or a negative
value) makes the cutoff `now` or later, so `enforceRetention()` drops the entire
history in one call. The old DTO's `@Min(1)` was correct, but `0` also fell
through the controller's `if (body.retentionDays)` truthiness check, and a
non-numeric value coerced to `NaN`.

*Control:* `@IsInt` + `@Min(1)` + `@Max(MAX_RETENTION_DAYS)` (10 years), and the
controller now tests `!== undefined` instead of truthiness.

*Residual risk:* the endpoint has no authentication. Retention changes should
require an admin role before this ships — tracked separately.

### 7. Mass assignment

*Attack:* post `hash`, `previousHash`, `id` or `createdAt` alongside the real
fields to plant a record with a forged chain position.

*Control:* the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
true })` in `Backend/src/main.ts` rejects any property not declared on the DTO.
The chain fields are computed server-side in `createLog()` and are not
DTO-settable. Covered by the "threat #7" block in the spec.

### 8. Beta access bypass

*Attack:* an unknown, revoked, or inactive actor submits an audit write directly
to the Nest endpoint, bypassing the frontend and any route-specific feature
checks.

*Control:* `MarketAuditService.createLog()` calls the injected beta access
checker before mutating the in-memory hash chain. A denied response becomes a
`403`, and a missing checker fails closed. The service spec covers both denied
access and an unavailable gate.

*Residual risk:* the `actor` value is still self-asserted by the caller. The
beta gate confirms enrollment, not wallet ownership; authenticated identity
binding remains a separate requirement.

## Not addressed here

- **AuthN/AuthZ.** No endpoint in this controller checks a caller identity;
  `actor` is self-asserted. Until that is fixed, treat `actor` as a claim, not an
  identity.
- **Durability.** Logs live in process memory and are lost on restart, which is
  also an integrity gap: a restart resets the chain to `GENESIS`.
- **Chain verification cost.** `verifyIntegrity()` is O(n) over every record with
  no pagination.

## Checklist for changes to this subsystem

- [ ] No secret, key, connection string or sample credential added to
      `dto/market-audit.dto.ts` — it is compiled into the public OpenAPI document.
- [ ] New free-text fields carry `@MaxLength`, `NO_CONTROL_CHARS` and
      `@ContainsNoSecrets()`.
- [ ] New query-string numbers carry `@Type(() => Number)` and a `@Max`.
- [ ] A negative-path case is added to `dto/market-audit.dto.spec.ts` for each
      new field.
- [ ] Any new threat gets a row in the DTO header table and a section here.
- [x] Audit writes are denied when the beta access gate rejects the actor.
