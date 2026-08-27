import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ContainsNoSecrets } from './no-secrets.validator';

/**
 * Input gate for the market audit trail.
 *
 * ## Why this file is a security boundary
 *
 * `MarketAuditService` keeps a hash-chained, append-only log: every record
 * commits to its predecessor's hash, and `verifyIntegrity()` walks that chain.
 * Two consequences drive the rules below.
 *
 *  1. **Nothing written here can ever be edited or redacted.** Removing or
 *     rewriting a record breaks the chain for every record after it, so a bad
 *     value is permanent. Rejecting it at the DTO is the only cheap moment.
 *  2. **Records are read far from where they were written** - the CSV export in
 *     `Frontend/components/audit/AuditLogViewer.tsx`, the summary report, and
 *     support tooling all render these strings.
 *
 * ## Threat notes
 *
 * | # | Abuse                          | Control                                                |
 * |---|--------------------------------|--------------------------------------------------------|
 * | 1 | Credential paste-in            | `@ContainsNoSecrets()` on free-text `details`           |
 * | 2 | Log flooding / memory DoS      | `@MaxLength` caps; `limit` bounded by `MAX_QUERY_LIMIT` |
 * | 3 | Log forging / line spoofing    | newlines and control chars rejected by the field rules  |
 * | 4 | CSV formula injection          | leading `=`, `+`, `-`, `@` rejected in `details`        |
 * | 5 | Query-parameter type confusion | `@Type(() => Number)` + `@IsInt` so `limit` is a number |
 * | 6 | Unbounded retention wipe       | `retentionDays` floor of 1, ceiling of 10 years         |
 * | 7 | Mass assignment                | global `ValidationPipe({ whitelist, forbidNonWhitelisted })` in `main.ts` |
 *
 * This file holds **no** secrets, keys, or connection strings, and must not gain
 * any: it is imported by the controller and compiled into the client-facing
 * OpenAPI document by `SwaggerModule`.
 *
 * Longer write-up: `docs/THREAT_MODEL_MARKET_AUDIT.md`.
 */

/** Upper bound on a single `queryLogs` page. Caps response size and CPU. */
export const MAX_QUERY_LIMIT = 1000;

/** Ten years. A retention window above this is indistinguishable from "never". */
export const MAX_RETENTION_DAYS = 3650;

export const AUDIT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/**
 * Identifiers are echoed into CSV cells and used as filter keys, so they are
 * restricted to an unambiguous slug charset. This excludes CR, LF and the whole
 * ASCII control range, which is what makes threat #3 unreachable.
 */
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const IDENTIFIER_MESSAGE =
  'must start alphanumeric and contain only letters, digits, dot, underscore, colon or hyphen';

/** Operations are a controlled vocabulary shape: SCREAMING_SNAKE_CASE. */
const OPERATION_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Free text still may not contain control characters (threat #3), and may not
 * *begin* with a spreadsheet formula sigil (threat #4) - Excel and Sheets
 * execute `=`, `+`, `-` and `@` prefixed cells straight out of the CSV export.
 */
// eslint-disable-next-line no-control-regex
const NO_CONTROL_CHARS = /^[^\x00-\x1F\x7F]*$/u;
const NOT_A_FORMULA = /^[^=+\-@]/;

export class CreateAuditLogDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER_PATTERN, { message: `marketId ${IDENTIFIER_MESSAGE}` })
  marketId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(OPERATION_PATTERN, {
    message: 'operation must be SCREAMING_SNAKE_CASE, e.g. CREATE_MARKET',
  })
  operation: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER_PATTERN, { message: `actor ${IDENTIFIER_MESSAGE}` })
  actor: string;

  /**
   * Free-form context. Capped at 2 KiB: this string is hashed into the chain and
   * repeated in every export, so an unbounded value is a cheap amplification
   * vector against both memory and the CSV download.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(NO_CONTROL_CHARS, {
    message: 'details must not contain control characters',
  })
  @Matches(NOT_A_FORMULA, {
    message: 'details must not begin with =, +, - or @ (CSV formula injection)',
  })
  @ContainsNoSecrets()
  details: string;

  @IsOptional()
  @IsIn(AUDIT_SEVERITIES)
  severity?: AuditSeverity;
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(IDENTIFIER_PATTERN, { message: `marketId ${IDENTIFIER_MESSAGE}` })
  marketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(OPERATION_PATTERN, {
    message: 'operation must be SCREAMING_SNAKE_CASE, e.g. CREATE_MARKET',
  })
  operation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(IDENTIFIER_PATTERN, { message: `actor ${IDENTIFIER_MESSAGE}` })
  actor?: string;

  /**
   * `queryLogs` feeds these straight into `new Date(...)`, which silently yields
   * `NaN` for junk and then drops every range check. Requiring ISO-8601 keeps
   * the filter honest instead of quietly returning the unfiltered log.
   */
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'from must be an ISO-8601 timestamp' },
  )
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'to must be an ISO-8601 timestamp' })
  to?: string;

  /**
   * Query strings arrive as text. Without `@Type(() => Number)` the global
   * `ValidationPipe` is not in transform mode, so `?limit=50` reaches `@IsInt`
   * as the string `"50"` and every paged request 400s.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1)
  @Max(MAX_QUERY_LIMIT, { message: `limit must not exceed ${MAX_QUERY_LIMIT}` })
  limit?: number;
}

export class RetentionPolicyDto {
  /**
   * Shrinking the window deletes history irreversibly, so the floor is one day
   * and the value must be a whole number of days - `0`, negatives and `NaN` are
   * all rejected rather than being coerced into "delete everything".
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'retentionDays must be an integer' })
  @Min(1)
  @Max(MAX_RETENTION_DAYS, {
    message: `retentionDays must not exceed ${MAX_RETENTION_DAYS}`,
  })
  retentionDays?: number;
}
