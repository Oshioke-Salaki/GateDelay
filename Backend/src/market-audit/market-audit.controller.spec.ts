import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MarketAuditController } from './market-audit.controller';
import { CreateAuditLogDto, AuditQueryDto } from './dto/market-audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketAuditAdminGuard } from './market-audit-admin.guard';
import { RATE_LIMIT_TIER_KEY } from '../rate-limiter/rate-limiter.config';
import { MarketAuditService } from './market-audit.service';

describe('MarketAuditController security', () => {
  it('requires the existing JWT guard on every audit route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, MarketAuditController);

    expect(guards).toEqual(
      expect.arrayContaining([JwtAuthGuard, MarketAuditAdminGuard]),
    );
  });

  it('uses the stricter admin rate-limit tier', () => {
    expect(
      Reflect.getMetadata(RATE_LIMIT_TIER_KEY, MarketAuditController),
    ).toBe('admin');
  });

  it('rejects injection-shaped identifiers and unbounded limits', async () => {
    const createErrors = await validate(
      plainToInstance(CreateAuditLogDto, {
        marketId: "market-1' OR '1'='1",
        operation: 'CREATE_MARKET',
        details: 'test',
      }),
    );
    const queryErrors = await validate(
      plainToInstance(AuditQueryDto, { operation: '<script>', limit: '1001' }),
    );

    expect(createErrors.map((error) => error.property)).toContain('marketId');
    expect(queryErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['operation', 'limit']),
    );
  });

  it('binds the audit actor to the authenticated principal', () => {
    const service = {
      createLog: jest.fn().mockReturnValue({ id: 'audit-1' }),
    } as unknown as MarketAuditService;
    const controller = new MarketAuditController(service);

    controller.createLog({ user: { id: 'authenticated-user' } } as never, {
      marketId: 'market-1',
      operation: 'CREATE_MARKET',
      details: 'created',
    });

    expect(service.createLog).toHaveBeenCalledWith(
      expect.objectContaining({ actor: 'authenticated-user' }),
    );
  });
});
