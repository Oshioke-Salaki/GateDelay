import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { BlockchainEventType } from '../event-notification.entity';

export class CreateEventFilterDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsArray()
  @IsEnum(
    [
      'TradeExecuted',
      'MarketCreated',
      'MarketResolved',
      'DepositConfirmed',
      'WithdrawalProcessed',
      'LiquidityAdded',
      'LiquidityRemoved',
      'PositionOpened',
      'PositionClosed',
    ],
    { each: true },
  )
  eventTypes: BlockchainEventType[];

  @IsString()
  @IsOptional()
  contractAddress?: string;

  @IsString()
  @IsOptional()
  minAmount?: string;
}

export class GetNotificationsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsOptional()
  status?: string;
}
