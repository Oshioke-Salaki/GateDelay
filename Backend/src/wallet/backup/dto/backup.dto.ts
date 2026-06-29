import { IsString, MinLength } from 'class-validator';

export class GenerateBackupDto {
  @IsString()
  @MinLength(8)
  password: string;
}

export class VerifyBackupDto {
  @IsString()
  encryptedData: string;

  @IsString()
  password: string;
}

export class RestoreBackupDto {
  @IsString()
  encryptedData: string;

  @IsString()
  password: string;
}
