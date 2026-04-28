import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FavoritesService } from './favorites.service';
import {
  AddFavoriteDto,
  UpdateFavoriteDto,
  SyncFavoritesDto,
  RecommendationsQueryDto,
} from './dto/favorites.dto';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Request() req: { user: { id: string } },
    @Body() dto: AddFavoriteDto,
  ) {
    return this.favoritesService.addFavorite(req.user.id, dto);
  }

  @Get()
  getAll(@Request() req: { user: { id: string } }) {
    return this.favoritesService.getFavorites(req.user.id);
  }

  @Get('analytics')
  getAnalytics(@Request() req: { user: { id: string } }) {
    return this.favoritesService.getAnalytics(req.user.id);
  }

  @Get('recommendations')
  getRecommendations(
    @Request() req: { user: { id: string } },
    @Query() query: RecommendationsQueryDto,
  ) {
    return this.favoritesService.getRecommendations(req.user.id, query);
  }

  @Get('sync')
  getSyncState(@Request() req: { user: { id: string } }) {
    return this.favoritesService.getSyncState(req.user.id);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  sync(
    @Request() req: { user: { id: string } },
    @Body() dto: SyncFavoritesDto,
  ) {
    return this.favoritesService.sync(req.user.id, dto);
  }

  @Get(':marketId')
  getOne(
    @Request() req: { user: { id: string } },
    @Param('marketId') marketId: string,
  ) {
    return this.favoritesService.getFavorite(req.user.id, marketId);
  }

  @Put(':marketId')
  update(
    @Request() req: { user: { id: string } },
    @Param('marketId') marketId: string,
    @Body() dto: UpdateFavoriteDto,
  ) {
    return this.favoritesService.updateFavorite(req.user.id, marketId, dto);
  }

  @Post(':marketId/view')
  @HttpCode(HttpStatus.OK)
  recordView(
    @Request() req: { user: { id: string } },
    @Param('marketId') marketId: string,
  ) {
    return this.favoritesService.recordView(req.user.id, marketId);
  }

  @Delete(':marketId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Request() req: { user: { id: string } },
    @Param('marketId') marketId: string,
  ) {
    return this.favoritesService.removeFavorite(req.user.id, marketId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAll(@Request() req: { user: { id: string } }) {
    return this.favoritesService.removeAllFavorites(req.user.id);
  }
}
