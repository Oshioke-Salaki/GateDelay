import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BlockchainService } from './blockchain.service';
import {
  CommitNonceDto,
  FillNonceGapsDto,
  ReleaseNonceDto,
  ReserveNonceDto,
  SyncNonceDto,
} from './dto/nonce.dto';
import { BroadcastTransactionDto } from './dto/transaction.dto';
import { NonceManagerService } from './nonce-manager.service';

@Controller('blockchain')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly nonceManagerService: NonceManagerService,
  ) {}

  @Post('broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  broadcast(@Body() dto: BroadcastTransactionDto) {
    return this.blockchainService.broadcastTransaction(dto);
  }

  @Get('tx/:hash')
  getStatus(@Param('hash') hash: string) {
    return this.blockchainService.getTransactionStatus(hash);
  }

  @Post('nonce/reserve')
  reserveNonce(@Body() dto: ReserveNonceDto) {
    return this.nonceManagerService.reserveNonce(
      dto.address,
      dto.network,
      dto.ttlMs,
    );
  }

  @Post('nonce/commit')
  commitNonce(@Body() dto: CommitNonceDto) {
    return this.nonceManagerService.commitReservation(
      dto.address,
      dto.reservationId,
      dto.network,
    );
  }

  @Post('nonce/release')
  releaseNonce(@Body() dto: ReleaseNonceDto) {
    return this.nonceManagerService.releaseReservation(
      dto.address,
      dto.reservationId,
      dto.network,
    );
  }

  @Post('nonce/sync')
  syncNonce(@Body() dto: SyncNonceDto) {
    return this.nonceManagerService.syncNonce(dto.address, dto.network);
  }

  @Post('nonce/fill-gaps')
  fillNonceGaps(@Body() dto: FillNonceGapsDto) {
    return this.nonceManagerService.fillNonceGaps(
      dto.address,
      dto.network,
      dto.reserveFirstGap,
      dto.ttlMs,
    );
  }

  @Get('nonce/:network/:address')
  getNonceState(
    @Param('network') network: string,
    @Param('address') address: string,
  ) {
    return this.nonceManagerService.getNonceState(address, network);
  }
}
