import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsIn,
} from 'class-validator';

export class OpenPositionDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsIn(['YES', 'NO'])
  side: 'YES' | 'NO';

  @IsNumber()
  @IsPositive()
  shares: number;

  @IsNumber()
  @IsPositive()
  entryPrice: number;
}

export class ClosePositionDto {
  @IsNumber()
  @IsPositive()
  currentPrice: number;
}
