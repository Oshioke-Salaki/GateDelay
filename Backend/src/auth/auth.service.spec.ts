import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as nodemailer from 'nodemailer';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'userid'),
}));

describe('AuthService abuse paths', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };
  let sendMail: jest.Mock;
  let tokenNonce: number;

  const validPassword = 'StrongPass1';

  beforeEach(() => {
    tokenNonce = 0;
    jwtService = {
      sign: jest.fn((payload, options) =>
        options?.secret
          ? `refresh-${payload.sub}-${++tokenNonce}`
          : `access-${payload.sub}-${++tokenNonce}`,
      ),
      verify: jest.fn((token) => ({ sub: token.split('-')[1] })),
    };
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRES_IN: '7d',
          FRONTEND_URL: 'http://localhost:3001',
          SMTP_HOST: 'smtp.test',
          SMTP_PORT: '587',
          SMTP_USER: 'smtp-user',
          SMTP_PASS: 'smtp-pass',
          EMAIL_FROM: 'noreply@test.invalid',
        };
        return values[key] ?? fallback;
      }),
    };
    sendMail = jest.fn().mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    service = new AuthService(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('rejects duplicate registration instead of replacing the account', async () => {
    await service.register({
      email: 'user@example.com',
      password: validPassword,
    });

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'AnotherPass2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('uses the same invalid-credentials failure for unknown users and bad passwords', async () => {
    await expect(
      service.login({ email: 'missing@example.com', password: validPassword }),
    ).rejects.toThrow('Invalid credentials');

    await service.register({
      email: 'user@example.com',
      password: validPassword,
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'WrongPass2' }),
    ).rejects.toThrow('Invalid credentials');
  });

  it('rejects reset-token reuse after a successful password reset', async () => {
    await service.register({
      email: 'user@example.com',
      password: validPassword,
    });
    await service.forgotPassword({ email: 'user@example.com' });

    const users = (service as any).users as Map<string, any>;
    const user = [...users.values()][0];
    const resetToken = user.resetToken;

    await expect(
      service.resetPassword({ token: resetToken, password: 'NewPass2' }),
    ).resolves.toEqual({ message: 'Password reset successfully' });
    await expect(
      service.resetPassword({ token: resetToken, password: 'ThirdPass3' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects expired reset tokens', async () => {
    await service.register({
      email: 'user@example.com',
      password: validPassword,
    });
    await service.forgotPassword({ email: 'user@example.com' });

    const users = (service as any).users as Map<string, any>;
    const user = [...users.values()][0];
    user.resetTokenExpiry = new Date(Date.now() - 1);

    await expect(
      service.resetPassword({ token: user.resetToken, password: 'NewPass2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects refresh-token replay after rotation and logout', async () => {
    const tokens = await service.register({
      email: 'user@example.com',
      password: validPassword,
    });

    const rotated = await service.refreshTokens(tokens.refreshToken);
    await expect(
      service.refreshTokens(tokens.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const userId = rotated.user.id;
    await service.logout(userId);
    await expect(
      service.refreshTokens(rotated.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('JwtStrategy validate method throws UnauthorizedException when sub is missing', async () => {
    const mockConfig = {
      get: jest.fn(() => 'jwtsecret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(mockConfig);
    await expect(
      strategy.validate({ sub: '', email: 'test@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
