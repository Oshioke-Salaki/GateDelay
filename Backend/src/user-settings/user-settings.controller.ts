import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserSettingsService } from './user-settings.service';
import { SettingCategory } from './user-settings.entity';
import {
  UpdateSettingDto,
  UpdateCategoryDto,
  BulkUpdateSettingsDto,
  SyncSettingsDto,
} from './dto/user-settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private readonly settingsService: UserSettingsService) {}

  @Get()
  getAll(@Request() req: { user: { id: string } }) {
    return this.settingsService.getAll(req.user.id);
  }

  @Get(':category')
  getCategory(
    @Request() req: { user: { id: string } },
    @Param('category') category: SettingCategory,
  ) {
    return this.settingsService.getCategory(req.user.id, category);
  }

  @Get(':category/:key')
  getSetting(
    @Request() req: { user: { id: string } },
    @Param('category') category: SettingCategory,
    @Param('key') key: string,
  ) {
    return this.settingsService.getSetting(req.user.id, category, key);
  }

  @Put(':category/:key')
  updateSetting(
    @Request() req: { user: { id: string } },
    @Param('category') category: SettingCategory,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.updateSetting(req.user.id, category, dto);
  }

  @Put(':category')
  updateCategory(
    @Request() req: { user: { id: string } },
    @Param('category') category: SettingCategory,
    @Body() dto: Omit<UpdateCategoryDto, 'category'> & { settings: Record<string, string | number | boolean> },
  ) {
    return this.settingsService.updateCategory(req.user.id, {
      category,
      settings: dto.settings,
    });
  }

  @Patch('bulk')
  @HttpCode(HttpStatus.OK)
  bulkUpdate(
    @Request() req: { user: { id: string } },
    @Body() dto: BulkUpdateSettingsDto,
  ) {
    return this.settingsService.bulkUpdate(req.user.id, dto);
  }

  @Delete(':category/:key')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetSetting(
    @Request() req: { user: { id: string } },
    @Param('category') category: SettingCategory,
    @Param('key') key: string,
  ) {
    return this.settingsService.deleteSetting(req.user.id, category, key);
  }

  @Post(':category/reset')
  @HttpCode(HttpStatus.OK)
  resetCategory(
    @Request() req: { user: { id: string } },
    @Param('category') category: SettingCategory,
  ) {
    return this.settingsService.resetCategory(req.user.id, category);
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  resetAll(@Request() req: { user: { id: string } }) {
    return this.settingsService.resetAll(req.user.id);
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  sync(
    @Request() req: { user: { id: string } },
    @Body() dto: SyncSettingsDto,
  ) {
    return this.settingsService.sync(req.user.id, dto);
  }
}
