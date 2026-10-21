import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import type { PasswordReset } from './entities/password-reset.entity';
import * as nodemailer from 'nodemailer';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => randomUUID()),
}));

describe('AuthService abuse paths', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };
  let sendMail: jest.Mock;
  let tokenNonce: number;

  const validPassword = 'StrongPass1';

  beforeEach(() => {
    jest.useFakeTimers();
    tokenNonce = 0;
    const payloads = new Map<string, unknown>();
    jwtService = {
      sign: jest.fn((payload, options) => {
        const token = options?.secret
          ? `refresh-${payload.sub}-${++tokenNonce}`
          : `access-${payload.sub}-${++tokenNonce}`;
        payloads.set(token, payload);
        return token;
      }),
      verify: jest.fn((token) => {
        if (!payloads.has(token)) throw new Error('Invalid token');
        return payloads.get(token);
      }),
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

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('rotates one device session without invalidating another device', async () => {
    const first = await service.register({ email: 'user@example.com', password: validPassword });
    const second = await service.login({ email: 'user@example.com', password: validPassword });
    const rotated = await service.refreshTokens(first.refreshToken);
    expect(rotated.sessionId).toBe(first.sessionId);
    await expect(service.refreshTokens(second.refreshToken)).resolves.toMatchObject({
      sessionId: second.sessionId,
    });
    const sessions = await service.getUserSessions(first.user.id);
    expect(sessions).toHaveLength(2);
    expect(sessions.every((session) => !('refreshToken' in session))).toBe(true);
  });

  it('logs out a selected session while keeping other sessions active', async () => {
    const first = await service.register({ email: 'user@example.com', password: validPassword });
    const second = await service.login({ email: 'user@example.com', password: validPassword });
    await service.logout(first.user.id, first.sessionId);
    await expect(service.refreshTokens(first.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refreshTokens(second.refreshToken)).resolves.toMatchObject({ sessionId: second.sessionId });
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

  it('normalizes email identity across registration, login, and password reset', async () => {
    const registration = await service.register({
      email: '  User@Example.COM  ',
      password: validPassword,
    });

    expect(registration.user.email).toBe('user@example.com');
    await expect(
      service.register({
        email: 'user@example.com',
        password: 'AnotherPass2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.login({ email: ' USER@example.com ', password: validPassword }),
    ).resolves.toMatchObject({ user: { email: 'user@example.com' } });

    await service.forgotPassword({ email: ' USER@EXAMPLE.COM ' });
    const resetOutbox = (service as any).resetOutbox as Map<string, any>;
    expect([...resetOutbox.values()][0].email).toBe('user@example.com');
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
    const resetToken = 'test-reset-token';
    (uuidv4 as jest.Mock).mockReturnValueOnce('reset-record').mockReturnValueOnce(resetToken);
    await service.forgotPassword({ email: 'user@example.com' });

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
    const resetToken = 'test-expired-reset-token';
    (uuidv4 as jest.Mock).mockReturnValueOnce('expired-reset-record').mockReturnValueOnce(resetToken);
    await service.forgotPassword({ email: 'user@example.com' });
    const resets = (service as unknown as { passwordResets: Map<string, PasswordReset> }).passwordResets;
    const reset = [...resets.values()][0];
    reset.expiresAt = new Date(Date.now() - 1);

    await expect(
      service.resetPassword({ token: resetToken, password: 'NewPass2' }),
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

  it('JwtStrategy keeps role claims available on the request user', async () => {
    const mockConfig = {
      get: jest.fn(() => 'jwtsecret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(mockConfig);

    await expect(
      strategy.validate({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'market_admin',
        roles: ['market_admin', 'settlement_admin'],
      }),
    ).resolves.toMatchObject({
      id: 'user-123',
      email: 'test@example.com',
      role: 'market_admin',
      roles: ['market_admin', 'settlement_admin'],
    });
  });
});
