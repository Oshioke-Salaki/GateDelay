import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  SocialLoginDto,
} from './auth.dto';

const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

function check<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): ValidationError[] {
  return validateSync(plainToInstance(cls, payload), PIPE_OPTIONS);
}

function failedProperties(errors: ValidationError[]): string[] {
  return errors.map((error) => error.property);
}

describe('Auth DTOs', () => {
  describe('RegisterDto', () => {
    const validRegister = {
      email: 'user@example.com',
      password: 'StrongPass1',
      name: 'Test User',
    };

    it('accepts a valid registration payload', () => {
      const errors = check(RegisterDto, validRegister);
      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid email', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        email: 'not-an-email',
      });
      expect(failedProperties(errors)).toContain('email');
    });

    it('rejects email exceeding max length', () => {
      const longEmail = 'a'.repeat(300) + '@example.com';
      const errors = check(RegisterDto, {
        ...validRegister,
        email: longEmail,
      });
      expect(failedProperties(errors)).toContain('email');
    });

    it('rejects password shorter than 8 characters', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        password: 'Ab1',
      });
      expect(failedProperties(errors)).toContain('password');
    });

    it('rejects password longer than 128 characters', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        password: 'A'.repeat(129),
      });
      expect(failedProperties(errors)).toContain('password');
    });

    it('rejects password without uppercase letter', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        password: 'lowercase1',
      });
      expect(failedProperties(errors)).toContain('password');
    });

    it('rejects password without lowercase letter', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        password: 'UPPERCASE1',
      });
      expect(failedProperties(errors)).toContain('password');
    });

    it('rejects password without digit', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        password: 'NoDigitsHere',
      });
      expect(failedProperties(errors)).toContain('password');
    });

    it('accepts optional name', () => {
      const errors = check(RegisterDto, {
        email: validRegister.email,
        password: validRegister.password,
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects name exceeding max length', () => {
      const errors = check(RegisterDto, {
        ...validRegister,
        name: 'X'.repeat(101),
      });
      expect(failedProperties(errors)).toContain('name');
    });
  });

  describe('LoginDto', () => {
    const validLogin = {
      email: 'user@example.com',
      password: 'password123',
    };

    it('accepts a valid login payload', () => {
      const errors = check(LoginDto, validLogin);
      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid email', () => {
      const errors = check(LoginDto, { ...validLogin, email: 'bad' });
      expect(failedProperties(errors)).toContain('email');
    });

    it('rejects empty password', () => {
      const errors = check(LoginDto, { ...validLogin, password: '' });
      expect(failedProperties(errors)).toContain('password');
    });

    it('rejects password exceeding max length', () => {
      const errors = check(LoginDto, {
        ...validLogin,
        password: 'X'.repeat(129),
      });
      expect(failedProperties(errors)).toContain('password');
    });
  });

  describe('ForgotPasswordDto', () => {
    it('accepts a valid email', () => {
      const errors = check(ForgotPasswordDto, { email: 'user@example.com' });
      expect(errors).toHaveLength(0);
    });

    it('rejects an invalid email', () => {
      const errors = check(ForgotPasswordDto, { email: 'not-email' });
      expect(failedProperties(errors)).toContain('email');
    });
  });

  describe('ResetPasswordDto', () => {
    const validReset = {
      token: 'abc-123-token',
      password: 'NewPass1',
    };

    it('accepts a valid reset payload', () => {
      const errors = check(ResetPasswordDto, validReset);
      expect(errors).toHaveLength(0);
    });

    it('rejects empty token', () => {
      const errors = check(ResetPasswordDto, {
        ...validReset,
        token: '',
      });
      expect(failedProperties(errors)).toContain('token');
    });

    it('rejects password shorter than 8 characters', () => {
      const errors = check(ResetPasswordDto, {
        ...validReset,
        password: 'Ab1',
      });
      expect(failedProperties(errors)).toContain('password');
    });

    it('rejects password without complexity', () => {
      const errors = check(ResetPasswordDto, {
        ...validReset,
        password: 'alllowercase',
      });
      expect(failedProperties(errors)).toContain('password');
    });
  });

  describe('RefreshTokenDto', () => {
    it('accepts a valid refresh token', () => {
      const errors = check(RefreshTokenDto, {
        refreshToken: 'valid.token.here',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects empty refresh token', () => {
      const errors = check(RefreshTokenDto, { refreshToken: '' });
      expect(failedProperties(errors)).toContain('refreshToken');
    });

    it('rejects refresh token exceeding max length', () => {
      const errors = check(RefreshTokenDto, {
        refreshToken: 'X'.repeat(2049),
      });
      expect(failedProperties(errors)).toContain('refreshToken');
    });
  });

  describe('SocialLoginDto', () => {
    it('accepts a valid Google social login', () => {
      const errors = check(SocialLoginDto, {
        provider: 'google',
        accessToken: 'valid-token',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts a valid Twitter social login', () => {
      const errors = check(SocialLoginDto, {
        provider: 'twitter',
        accessToken: 'valid-token',
      });
      expect(errors).toHaveLength(0);
    });

    it('rejects unknown provider', () => {
      const errors = check(SocialLoginDto, {
        provider: 'facebook',
        accessToken: 'token',
      });
      expect(failedProperties(errors)).toContain('provider');
    });

    it('rejects empty accessToken', () => {
      const errors = check(SocialLoginDto, {
        provider: 'google',
        accessToken: '',
      });
      expect(failedProperties(errors)).toContain('accessToken');
    });

    it('rejects accessToken exceeding max length', () => {
      const errors = check(SocialLoginDto, {
        provider: 'google',
        accessToken: 'X'.repeat(2049),
      });
      expect(failedProperties(errors)).toContain('accessToken');
    });
  });
});
