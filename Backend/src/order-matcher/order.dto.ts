import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsPositive,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PlaceOrderDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsIn(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsIn(['YES', 'NO'])
  outcome: 'YES' | 'NO';

  @IsNumber()
  @IsPositive()
  @Min(0.01)
  @Max(0.99)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;
}

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;
}
