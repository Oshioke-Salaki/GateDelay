import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class LogoutSessionDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}

export class DeviceInfoDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  userAgent?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  deviceInfo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(45)
  ipAddress?: string;
}
