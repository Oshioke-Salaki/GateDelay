import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SocialLoginDto,
} from './dto/auth.dto';
import { User } from './entities/user.entity';

@Injectable()
export class AuthService {
  // In-memory store — replace with a real DB in production
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map(); // email -> id

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (this.usersByEmail.has(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    const id = uuidv4();
    const hashed = await bcrypt.hash(dto.password, 10);
    const user: User = {
      id,
      email: dto.email,
      password: hashed,
      name: dto.name,
      provider: 'local',
      createdAt: new Date(),
    };
    this.users.set(id, user);
    this.usersByEmail.set(dto.email, id);
    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const userId = this.usersByEmail.get(dto.email);
    if (!userId) throw new UnauthorizedException('Invalid credentials');
    const user = this.users.get(userId)!;
    if (!user.password) throw new UnauthorizedException('Use social login');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.generateTokens(user);
  }

  async socialLogin(dto: SocialLoginDto) {
    // Verify token with provider and extract profile
    const profile = await this.verifySocialToken(dto.provider, dto.accessToken);
    let userId = this.usersByEmail.get(profile.email);
    if (!userId) {
      userId = uuidv4();
      const user: User = {
        id: userId,
        email: profile.email,
        name: profile.name,
        provider: dto.provider,
        providerId: profile.id,
        createdAt: new Date(),
      };
      this.users.set(userId, user);
      this.usersByEmail.set(profile.email, userId);
    }
    return this.generateTokens(this.users.get(userId)!);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const userId = this.usersByEmail.get(dto.email);
    if (!userId)
      return { message: 'If the email exists, a reset link was sent' };
    const user = this.users.get(userId)!;
    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 3600_000); // 1 hour
    await this.sendResetEmail(dto.email, token);
    return { message: 'If the email exists, a reset link was sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = [...this.users.values()].find(
      (u) => u.resetToken === dto.token && u.resetTokenExpiry! > new Date(),
    );
    if (!user) throw new BadRequestException('Invalid or expired reset token');
    user.password = await bcrypt.hash(dto.password, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    return { message: 'Password reset successfully' };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = this.users.get(payload.sub);
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException();
      }
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    const user = this.users.get(userId);
    if (user) user.refreshToken = undefined;
    return { message: 'Logged out successfully' };
  }

  private generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as any,
    });
    user.refreshToken = refreshToken;
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  private async verifySocialToken(
    provider: string,
    accessToken: string,
  ): Promise<{ id: string; email: string; name: string }> {
    // Stub: in production, call Google/Twitter APIs to verify the token
    // For Google: https://www.googleapis.com/oauth2/v3/userinfo
    // For Twitter: https://api.twitter.com/2/users/me
    throw new BadRequestException(
      `Social login via ${provider} not yet configured`,
    );
  }

  private async sendResetEmail(email: string, token: string) {
    const transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3001')}/reset-password?token=${token}`;
    await transporter.sendMail({
      from: this.configService.get('EMAIL_FROM', 'noreply@gatedelay.com'),
      to: email,
      subject: 'GateDelay - Password Reset',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    });
  }
}
