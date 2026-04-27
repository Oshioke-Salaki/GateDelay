import {
  Controller,
  Get,
  Post,
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
import { ResolutionService } from './resolution.service';
import {
  RequestResolutionDto,
  ConfirmResolutionDto,
  DisputeResolutionDto,
  ReviewDisputeDto,
} from './dto/resolution.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('resolution')
@UseGuards(JwtAuthGuard)
export class ResolutionController {
  constructor(private readonly resolutionService: ResolutionService) {}

  // ── Status endpoints ─────────────────────────────────────────────────────────

  /** GET /api/resolution — list all resolutions, optionally filtered by status */
  @Get()
  list(@Query('status') status?: string) {
    return this.resolutionService.listResolutions(status);
  }

  /** GET /api/resolution/market/:marketId — resolution status for a market */
  @Get('market/:marketId')
  getMarketStatus(@Param('marketId') marketId: string) {
    return this.resolutionService.getStatus(marketId);
  }

  /** GET /api/resolution/:id — single resolution by id */
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.resolutionService.getResolutionById(id);
  }

  // ── Manual resolution request ────────────────────────────────────────────────

  /** POST /api/resolution — submit a manual resolution request */
  @Post()
  request(
    @Request() req: { user: { id: string } },
    @Body() dto: RequestResolutionDto,
  ) {
    return this.resolutionService.requestResolution(req.user.id, dto);
  }

  /** DELETE /api/resolution/:id — cancel a pending resolution request */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.resolutionService.cancelResolution(req.user.id, id);
  }

  // ── Confirmation ─────────────────────────────────────────────────────────────

  /** POST /api/resolution/:id/confirm — confirm a resolution */
  @Post(':id/confirm')
  confirm(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ConfirmResolutionDto,
  ) {
    return this.resolutionService.confirmResolution(req.user.id, id, dto);
  }

  /** GET /api/resolution/:id/confirmations — list confirmations for a resolution */
  @Get(':id/confirmations')
  getConfirmations(@Param('id') id: string) {
    return this.resolutionService.getConfirmations(id);
  }

  /** PATCH /api/resolution/:id/finalise — finalise a confirmed resolution */
  @Patch(':id/finalise')
  finalise(@Param('id') id: string) {
    return this.resolutionService.finaliseResolution(id);
  }

  // ── Reports ──────────────────────────────────────────────────────────────────

  /** GET /api/resolution/market/:marketId/report — generate resolution report */
  @Get('market/:marketId/report')
  report(@Param('marketId') marketId: string) {
    return this.resolutionService.generateReport(marketId);
  }

  // ── Dispute workflow ─────────────────────────────────────────────────────────

  /** POST /api/resolution/:id/dispute — raise a dispute on a resolution */
  @Post(':id/dispute')
  dispute(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: DisputeResolutionDto,
  ) {
    return this.resolutionService.raiseDispute(req.user.id, id, dto);
  }

  /** GET /api/resolution/:id/disputes — list disputes for a resolution */
  @Get(':id/disputes')
  getDisputes(@Param('id') id: string) {
    return this.resolutionService.getDisputes(id);
  }

  /** GET /api/resolution/disputes/:disputeId — get a single dispute */
  @Get('disputes/:disputeId')
  getDispute(@Param('disputeId') disputeId: string) {
    return this.resolutionService.getDisputeById(disputeId);
  }

  /** PATCH /api/resolution/disputes/:disputeId/review — review (uphold/reject) a dispute */
  @Patch('disputes/:disputeId/review')
  reviewDispute(
    @Param('disputeId') disputeId: string,
    @Body() dto: ReviewDisputeDto,
  ) {
    return this.resolutionService.reviewDispute(disputeId, dto);
  }
}
