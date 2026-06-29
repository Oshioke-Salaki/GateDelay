import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeysService } from './api-keys.service';
import {
  CreateApiKeyDto,
  ListApiKeysQueryDto,
  RevokeApiKeyDto,
  RotateApiKeyDto,
  ValidateApiKeyDto,
} from './dto/api-keys.dto';

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createKey(req.user.id, dto);
  }

  @Get()
  list(
    @Request() req: { user: { id: string } },
    @Query() query: ListApiKeysQueryDto,
  ) {
    return this.apiKeysService.listKeys(req.user.id, query.status);
  }

  @Get(':keyId/usage')
  usage(
    @Request() req: { user: { id: string } },
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.getUsageAnalytics(req.user.id, keyId);
  }

  @Post(':keyId/revoke')
  revoke(
    @Request() req: { user: { id: string } },
    @Param('keyId') keyId: string,
    @Body() dto: RevokeApiKeyDto,
  ) {
    return this.apiKeysService.revokeKey(req.user.id, keyId, dto.reason);
  }

  @Post(':keyId/rotate')
  @HttpCode(HttpStatus.CREATED)
  rotate(
    @Request() req: { user: { id: string } },
    @Param('keyId') keyId: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.apiKeysService.rotateKey(req.user.id, keyId, dto);
  }

  @Post('validate')
  validate(@Body() dto: ValidateApiKeyDto) {
    return this.apiKeysService.validate(dto);
  }
}
