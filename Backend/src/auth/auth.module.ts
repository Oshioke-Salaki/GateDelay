import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * ============================================================================
 * SECURITY TRUST ASSUMPTIONS (Phase 2):
 *
 * 1. Oracles: Oracle responses are parsed/used downstream in prediction pricing.
 *    AuthModule does not trust oracle signatures directly; oracle validation and
 *    trust boundaries are verified in oracle routes and services.
 * 2. Multisig: Access controls for privileged system mutations require
 *    multisig signing guards rather than single-sig bearer JWTs. Privileged
 *    actions must verify multi-signature proof independent of AuthModule.
 * 3. Beta Access: Access to the beta endpoints is gated by check-in logic
 *    leveraging HMAC validation (via BETA_INVITE_SECRET) outside this module.
 * 4. Key Management: No secrets, passwords, or private keys are hardcoded in
 *    AuthModule. All JWT/SMTP secrets are injected dynamically via ConfigService.
 * ============================================================================
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') as StringValue,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
