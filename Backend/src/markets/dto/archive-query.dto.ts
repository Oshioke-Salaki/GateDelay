import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

export const ARCHIVE_OUTCOMES = ['yes', 'no', 'cancelled'] as const;
export type ArchiveOutcome = (typeof ARCHIVE_OUTCOMES)[number];

/** Upper bound on a single `GET /markets/archive` page. */
export const MAX_ARCHIVE_PAGE_SIZE = 500;
export const DEFAULT_ARCHIVE_PAGE_SIZE = 50;

const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Rejects `to` earlier than `from` (both already validated as ISO 8601). */
@ValidatorConstraint({ name: 'archiveDateRange', async: false })
class ArchiveDateRangeConstraint implements ValidatorConstraintInterface {
  validate(to: unknown, args: ValidationArguments): boolean {
    const from = (args.object as ArchiveQueryDto).from;
    if (typeof from !== 'string' || typeof to !== 'string') return true;
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    // Unparseable values are reported by @IsISO8601, not here.
    return Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs <= toMs;
  }

  defaultMessage(): string {
    return 'to must not be earlier than from';
  }
}

/**
 * Query DTO for `GET /markets/archive` (#1357).
 *
 * Replaces the previous `Record<string, unknown>` handling, which coerced
 * `page=abc` / `limit=-5` to defaults, treated any unknown `outcome` as
 * `cancelled`, and silently ignored unparseable dates. Invalid values are now
 * rejected with 400 by the global `ValidationPipe` (`transform`, `whitelist`,
 * `forbidNonWhitelisted`) before any filtering happens.
 */
export class ArchiveQueryDto {
  @IsOptional()
  @Transform(trimLower)
  @IsString()
  @MaxLength(64)
  category?: string;

  /** Case-insensitive; normalised to lower case. */
  @IsOptional()
  @Transform(trimLower)
  @IsIn(ARCHIVE_OUTCOMES, {
    message: `outcome must be one of: ${ARCHIVE_OUTCOMES.join(', ')}`,
  })
  outcome?: ArchiveOutcome;

  /** ISO 8601 date or date-time; inclusive lower bound on the resolution date. */
  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'from must be a valid ISO 8601 date' },
  )
  from?: string;

  /** ISO 8601 date or date-time; inclusive upper bound, not earlier than `from`. */
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'to must be a valid ISO 8601 date' })
  @Validate(ArchiveDateRangeConstraint)
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(MAX_ARCHIVE_PAGE_SIZE, {
    message: `limit must not exceed ${MAX_ARCHIVE_PAGE_SIZE}`,
  })
  limit?: number;
}
