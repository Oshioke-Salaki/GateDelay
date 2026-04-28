import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: Partial<CreateCategoryDto>,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.categoriesService.delete(id);
  }

  @Get()
  async getTree() {
    return this.categoriesService.getTree();
  }

  @Post(':id/popularity')
  async incrementPopularity(@Param('id') id: string) {
    return this.categoriesService.incrementPopularity(id);
  }

  @Post(':id/markets/:marketId')
  async assignMarket(
    @Param('id') id: string,
    @Param('marketId') marketId: string,
  ) {
    return this.categoriesService.assignMarket(id, marketId);
  }

  @Get(':id/markets')
  async getMarkets(
    @Param('id') id: string,
    @Query('includeChildren') includeChildren: string = 'true',
  ) {
    return this.categoriesService.getMarketsByCategory(
      id,
      includeChildren === 'true',
    );
  }
}
