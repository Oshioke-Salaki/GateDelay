import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalService } from './approval.service';
import {
  GenerateApprovalDto,
  ConfirmApprovalDto,
  BatchApprovalDto,
  ApprovalStatusQueryDto,
} from './dto/approval.dto';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @Request() req: { user: { id: string } },
    @Body() dto: GenerateApprovalDto,
  ) {
    return this.approvalService.generateApprovalTransaction(req.user.id, dto);
  }

  @Post(':approvalId/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(
    @Param('approvalId') approvalId: string,
    @Body() dto: ConfirmApprovalDto,
  ) {
    return this.approvalService.confirmApproval(approvalId, dto);
  }

  @Get(':approvalId/status')
  getStatus(@Param('approvalId') approvalId: string) {
    return this.approvalService.getApprovalStatus(approvalId);
  }

  @Get()
  getMyApprovals(
    @Request() req: { user: { id: string } },
    @Query() query: ApprovalStatusQueryDto,
  ) {
    return this.approvalService.getUserApprovals(req.user.id, query);
  }

  @Get('allowance/:tokenAddress/:ownerAddress/:spenderAddress')
  getAllowance(
    @Param('ownerAddress') ownerAddress: string,
    @Param('spenderAddress') spenderAddress: string,
    @Param('tokenAddress') tokenAddress: string,
  ) {
    return this.approvalService.getAllowance(
      ownerAddress,
      spenderAddress,
      tokenAddress,
    );
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  createBatch(
    @Request() req: { user: { id: string } },
    @Body() dto: BatchApprovalDto,
  ) {
    return this.approvalService.createBatchApproval(req.user.id, dto);
  }

  @Get('batch/:batchId/status')
  getBatchStatus(@Param('batchId') batchId: string) {
    return this.approvalService.getBatchStatus(batchId);
  }
}
