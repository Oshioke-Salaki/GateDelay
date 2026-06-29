import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class VerifyMarketDto {
  @IsObject()
  payload: Record<string, unknown>;

  @IsString()
  dataSource: string;

  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/, {
    message: 'signature must be a 65-byte hex string with 0x prefix',
  })
  signature?: string;

  @ValidateIf((dto: VerifyMarketDto) => Boolean(dto.signature))
  @IsString()
  signerAddress?: string;
}

export class ValidateCertificateDto {
  @IsString()
  certificateId: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(/^0x[0-9a-fA-F]{130}$/, {
    message: 'signature must be a 65-byte hex string with 0x prefix',
  })
  signature?: string;

  @ValidateIf((dto: ValidateCertificateDto) => Boolean(dto.signature))
  @IsString()
  signerAddress?: string;
}
