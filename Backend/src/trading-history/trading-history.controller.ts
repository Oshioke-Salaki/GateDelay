import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
    Request,
    Query,
    HttpCode,
    HttpStatus,
    Header,
} from '@nestjs/common';
import { TradingHistoryService } from './trading-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetTradingHistoryDto, ExportTradingHistoryDto } from './dto/trading-history.dto';

@Controller('trading-history')
@UseGuards(JwtAuthGuard)
export class TradingHistoryController {
    constructor(private readonly tradingHistoryService: TradingHistoryService) { }

    @Get()
    getTradingHistory(@Request() req: any, @Query() dto: GetTradingHistoryDto) {
        return this.tradingHistoryService.getTradingHistory(req.user.userId, dto);
    }

    @Get('metrics')
    getPerformanceMetrics(@Request() req: any) {
        return this.tradingHistoryService.getPerformanceMetrics(req.user.userId);
    }

    @Post('export')
    @HttpCode(HttpStatus.OK)
    @Header('Content-Type', 'text/plain')
    exportTradingHistory(@Request() req: any, @Body() dto: ExportTradingHistoryDto) {
        return this.tradingHistoryService.exportTradingHistory(req.user.userId, dto);
    }
}
