import {
  IsEthereumAddress,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumberString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateApprovalDto {
  @IsEthereumAddress()
  ownerAddress: string;

  @IsEthereumAddress()
  spenderAddress: string;

  @IsEthereumAddress()
  tokenAddress: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;
}

export class ConfirmApprovalDto {
  @IsString()
  @IsNotEmpty()
  txHash: string;
}

export class BatchApprovalItemDto {
  @IsEthereumAddress()
  spenderAddress: string;

  @IsEthereumAddress()
  tokenAddress: string;

  @IsNumberString()
  @IsNotEmpty()
  amount: string;
}

export class BatchApprovalDto {
  @IsEthereumAddress()
  ownerAddress: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BatchApprovalItemDto)
  approvals: BatchApprovalItemDto[];
}

export class ApprovalStatusQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  tokenAddress?: string;
}
