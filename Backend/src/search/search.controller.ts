import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() dto: SearchQueryDto) {
    return this.searchService.search(dto);
  }

  @Get('suggestions')
  suggestions(@Query('q') q: string) {
    return this.searchService.getSuggestions(q ?? '');
  }
}
