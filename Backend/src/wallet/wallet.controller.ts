import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ConnectWalletDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /** GET /wallets/challenge — get a server-issued challenge for wallet connection */
  @Get('challenge')
  getChallenge() {
    // Import ReplayProtectionService if needed
    const nonce = this.walletService.generateChallenge();
    return {
      nonce,
      timestamp: Date.now(),
      expiresIn: 300000, // 5 minutes
    };
  }

  /** POST /wallets/connect — verify signature and store wallet association */
  @Post('connect')
  @HttpCode(HttpStatus.CREATED)
  connect(
    @Request() req: { user: { userId: string } },
    @Body() dto: ConnectWalletDto,
  ) {
    return this.walletService.connectWallet(req.user.userId, dto);
  }

  /** GET /wallets/me — list all wallets for the authenticated user */
  @Get('me')
  getMyWallets(@Request() req: { user: { userId: string } }) {
    return this.walletService.getUserWallets(req.user.userId);
  }

  /** GET /wallets/:address/balance — native token balance for any address */
  @Get(':address/balance')
  getBalance(@Param('address') address: string) {
    return this.walletService.getBalance(address);
  }

  /** DELETE /wallets/:address — disconnect a wallet from the authenticated user */
  @Delete(':address')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect(
    @Request() req: { user: { userId: string } },
    @Param('address') address: string,
  ) {
    return this.walletService.disconnectWallet(req.user.userId, address);
  }
}
