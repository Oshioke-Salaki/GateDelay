import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import {
  InitiateWithdrawalDto,
  SubmitWithdrawalTxHashDto,
  MultiSigSignatureDto,
  WithdrawalQueryDto,
} from './dto/withdrawal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('withdrawals')
@UseGuards(JwtAuthGuard)
export class WithdrawalController {
  constructor(private readonly withdrawalService: WithdrawalService) {}

  /**
   * POST /withdrawals
   * Validate and create a new withdrawal request.
   * Returns unsigned tx data for the client to broadcast.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  initiate(
    @Request() req: { user: { userId: string } },
    @Body() dto: InitiateWithdrawalDto,
  ) {
    return this.withdrawalService.initiateWithdrawal(req.user.userId, dto);
  }

  /**
   * GET /withdrawals
   * List all withdrawals for the authenticated user, optionally filtered by status.
   */
  @Get()
  list(
    @Request() req: { user: { userId: string } },
    @Query() query: WithdrawalQueryDto,
  ) {
    return this.withdrawalService.listWithdrawals(req.user.userId, query);
  }

  /**
   * GET /withdrawals/:id
   * Get current status of a withdrawal, refreshing on-chain confirmations if needed.
   */
  @Get(':id')
  getStatus(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.withdrawalService.getStatus(id, req.user.userId);
  }

  /**
   * PATCH /withdrawals/:id/submit
   * Submit the on-chain tx hash after the client has broadcast the transaction.
   */
  @Patch(':id/submit')
  submitTxHash(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SubmitWithdrawalTxHashDto,
  ) {
    return this.withdrawalService.submitTxHash(id, req.user.userId, dto);
  }

  /**
   * DELETE /withdrawals/:id
   * Cancel a withdrawal that is still in 'pending' state (not yet submitted on-chain).
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.withdrawalService.cancelWithdrawal(id, req.user.userId);
  }

  /**
   * POST /withdrawals/:id/signatures
   * Add a signer's signature for a multi-sig withdrawal.
   */
  @Post(':id/signatures')
  @HttpCode(HttpStatus.OK)
  addSignature(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: MultiSigSignatureDto,
  ) {
    return this.withdrawalService.addMultiSigSignature(
      id,
      req.user.userId,
      dto,
    );
  }

  /**
   * GET /withdrawals/:id/multisig
   * Get current multi-sig status for a withdrawal.
   */
  @Get(':id/multisig')
  getMultiSig(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string,
  ) {
    return this.withdrawalService.getMultiSigStatus(id, req.user.userId);
  }
}
