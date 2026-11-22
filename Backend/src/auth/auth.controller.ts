import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  RefreshTokenDto,
  SocialLoginDto,
} from './dto/auth.dto';
import { LogoutSessionDto } from './dto/session.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator';

@Controller('auth')
@RateLimit('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractDeviceInfo(headers: any, ip: string) {
    return {
      userAgent: headers['user-agent'],
      ipAddress: ip,
      deviceInfo: headers['x-device-info'],
    };
  }

  @Post('register')
  register(
    @Body() dto: RegisterDto,
    @Headers() headers: any,
    @Ip() ip: string,
  ) {
    return this.authService.register(dto, this.extractDeviceInfo(headers, ip));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers() headers: any,
    @Ip() ip: string,
  ) {
    return this.authService.login(dto, this.extractDeviceInfo(headers, ip));
  }

  @Post('social')
  @HttpCode(HttpStatus.OK)
  socialLogin(
    @Body() dto: SocialLoginDto,
    @Headers() headers: any,
    @Ip() ip: string,
  ) {
    return this.authService.socialLogin(dto, this.extractDeviceInfo(headers, ip));
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshTokenDto,
    @Headers() headers: any,
    @Ip() ip: string,
  ) {
    return this.authService.refreshTokens(
      dto.refreshToken,
      this.extractDeviceInfo(headers, ip),
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(
    @Request() req: { user: { id: string } },
    @Body() dto?: LogoutSessionDto,
  ) {
    return this.authService.logout(req.user.id, dto?.sessionId);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logoutAll(@Request() req: { user: { id: string } }) {
    return this.authService.logoutAll(req.user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  getSessions(@Request() req: { user: { id: string } }) {
    return this.authService.getUserSessions(req.user.id);
  }
}
