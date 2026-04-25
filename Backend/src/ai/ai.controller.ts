import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { AnalysisRequestDto } from './dto/analysis.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * POST /api/ai/analyze
   * Returns AI-generated market analysis from Groq.
   * Results are cached for 5 minutes per marketId.
   */
  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  analyze(@Body() dto: AnalysisRequestDto) {
    return this.aiService.analyzeMarket(dto);
  }
}
