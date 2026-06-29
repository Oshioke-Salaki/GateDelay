import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';

export enum OrderType {
  Market = 'Market',
  Limit = 'Limit',
  StopLoss = 'Stop-Loss',
}

export enum OrderSide {
  Buy = 'Buy',
  Sell = 'Sell',
}

export class PlaceOrderDto {
  @IsString()
  @IsNotEmpty()
  pair: string;

  @IsEnum(OrderType)
  type: OrderType;

  @IsEnum(OrderSide)
  side: OrderSide;

  /** Required for Limit and Stop-Loss orders */
  @IsNumberString()
  @IsOptional()
  price?: string;

  /** Required for Stop-Loss orders */
  @IsNumberString()
  @IsOptional()
  stopPrice?: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;
}
