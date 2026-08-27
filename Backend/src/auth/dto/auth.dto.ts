import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one digit',
  })
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  refreshToken: string;
}

export class SocialLoginDto {
  @IsString()
  @IsIn(['google', 'twitter'])
  provider: 'google' | 'twitter';

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  accessToken: string;
}
