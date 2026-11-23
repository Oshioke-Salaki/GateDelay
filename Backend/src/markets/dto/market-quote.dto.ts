import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class MarketQuoteQueryDto {
  @IsIn(['buy', 'sell'])
  side: 'buy' | 'sell';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  outcome: number;

  @IsString()
  @Matches(/^[1-9]\d*$/, {
    message: 'shares must be a positive integer amount in base units',
  })
  shares: string;
}
