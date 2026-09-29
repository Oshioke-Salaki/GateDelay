import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Upper bound on a single `GET /markets` page. */
export const MAX_MARKETS_PAGE_SIZE = 100;

/**
 * Query DTO for the market list endpoint (#916).
 *
 * Query strings arrive as text, so both fields need `@Type(() => Number)`:
 * the global `ValidationPipe` in src/main.ts is configured with
 * `whitelist`/`forbidNonWhitelisted` but *not* `transform`, which would leave
 * `?limit=20` reaching `@IsInt()` as the string `"20"` and 400 every request.
 */
export class ListMarketsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(MAX_MARKETS_PAGE_SIZE, {
    message: `limit must not exceed ${MAX_MARKETS_PAGE_SIZE}`,
  })
  limit?: number;
}
