import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BroadcastTransactionDto } from './dto/transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('blockchain')
@UseGuards(JwtAuthGuard)
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Post('broadcast')
  @HttpCode(HttpStatus.ACCEPTED)
  broadcast(@Body() dto: BroadcastTransactionDto) {
    return this.blockchainService.broadcastTransaction(dto);
  }

  @Get('tx/:hash')
  getStatus(@Param('hash') hash: string) {
    return this.blockchainService.getTransactionStatus(hash);
  }
}
