import {
  IsBoolean,
  IsEthereumAddress,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ReserveNonceDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  @IsOptional()
  network?: string;

  @IsInt()
  @Min(1000)
  @IsOptional()
  ttlMs?: number;
}

export class CommitNonceDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  @IsOptional()
  network?: string;

  @IsString()
  @IsNotEmpty()
  reservationId: string;
}

export class ReleaseNonceDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  @IsOptional()
  network?: string;

  @IsString()
  @IsNotEmpty()
  reservationId: string;
}

export class SyncNonceDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  @IsOptional()
  network?: string;
}

export class FillNonceGapsDto {
  @IsEthereumAddress()
  address: string;

  @IsString()
  @IsOptional()
  network?: string;

  @IsBoolean()
  @IsOptional()
  reserveFirstGap?: boolean;

  @IsInt()
  @Min(1000)
  @IsOptional()
  ttlMs?: number;
}
