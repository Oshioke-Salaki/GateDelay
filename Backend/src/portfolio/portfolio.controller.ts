import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  getPortfolio(@Request() req: { user: { id: string } }) {
    return this.portfolioService.getPortfolio(req.user.id);
  }

  @Get('history')
  getHistory(@Request() req: { user: { id: string } }) {
    return this.portfolioService.getHistory(req.user.id);
  }
}
