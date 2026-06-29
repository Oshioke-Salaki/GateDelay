import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class AddLiquidityDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  amountEth: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoManage?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  targetYesRatio?: number;
}

export class RemoveLiquidityDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsNumber()
  @Min(0.000001)
  @Type(() => Number)
  shareAmount: number;
}

export class AutoManagePositionDto {
  @IsString()
  @IsNotEmpty()
  marketId: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  autoManage?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  targetYesRatio?: number;
}
