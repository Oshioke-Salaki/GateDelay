import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
  IsNotEmpty,
} from 'class-validator';

// Auth DTOs accept only bounded, typed values. Secrets remain opaque here and
// must be verified by AuthService; this boundary does not log or interpolate them.
export class RegisterDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @IsNotEmpty()
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
  @Matches(/^[\p{L}\p{M}\p{N} .'-]+$/u, {
    message: 'name contains unsupported characters',
  })
  name?: string;
}

export class LoginDto {
  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/\S/, { message: 'password must not be blank' })
  password: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(320)
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/\S/, { message: 'token must not be blank' })
  token: string;

  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(/\S/, { message: 'refreshToken must not be blank' })
  refreshToken: string;
}

export class SocialLoginDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['google', 'twitter'])
  provider: 'google' | 'twitter';

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(/\S/, { message: 'accessToken must not be blank' })
  accessToken: string;
}
