import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { AnalysisRequestDto } from './dto/analysis.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /ai/analyze
   * Returns full AI-generated market analysis from Groq.
   * Results are cached for 5 minutes per marketId.
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(@Body() dto: AnalysisRequestDto) {
    return this.aiService.analyzeMarket(dto);
  }

  /**
   * GET /ai/sentiment/:marketId
   * Returns only the cached trading signal for a previously analysed market.
   * Responds 404 if the market has not been analysed yet.
   */
  @Get('sentiment/:marketId')
  async getSentiment(@Param('marketId') marketId: string) {
    const analysis = await this.aiService.getCachedAnalysis(marketId);
    if (!analysis) {
      throw new NotFoundException(
        `No cached analysis for market ${marketId}. Call POST /ai/analyze first.`,
      );
    }
    return {
      marketId: analysis.marketId,
      signal: analysis.signal,
      risk: analysis.risk,
      summary: analysis.summary,
      generatedAt: analysis.generatedAt,
    };
  }

}
