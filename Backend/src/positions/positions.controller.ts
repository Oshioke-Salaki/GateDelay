import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PositionsService } from './positions.service';
import { OpenPositionDto, ClosePositionDto } from './dto/position.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('positions')
@UseGuards(JwtAuthGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Post()
  open(@Request() req: { user: { id: string } }, @Body() dto: OpenPositionDto) {
    return this.positionsService.open(req.user.id, dto);
  }

  @Get()
  list(@Request() req: { user: { id: string } }) {
    return this.positionsService.getUserPositions(req.user.id);
  }

  @Get(':id')
  getOne(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    return this.positionsService.getOne(req.user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  close(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: ClosePositionDto,
  ) {
    return this.positionsService.close(req.user.id, id, dto);
  }
}
