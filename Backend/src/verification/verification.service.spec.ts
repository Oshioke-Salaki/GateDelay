import { Test, TestingModule } from '@nestjs/testing';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  let service: VerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VerificationService],
    }).compile();

    service = module.get<VerificationService>(VerificationService);
  });

  it('generates a certificate and stores market history', () => {
    const certificate = service.verifyMarket('market-1', 'oracle-a', {
      price: 0.62,
      volume: 1337,
    });

    expect(certificate.id).toBeDefined();
    expect(certificate.integrityVerified).toBe(true);
    expect(certificate.authenticityVerified).toBe(false);

    const history = service.getMarketHistory('market-1');
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(certificate.id);
  });

  it('validates third-party payload integrity using certificate hash', () => {
    const certificate = service.verifyMarket('market-2', 'oracle-b', {
      status: 'open',
      latencyMs: 250,
    });

    const validResult = service.validateCertificate(certificate.id, {
      status: 'open',
      latencyMs: 250,
    });

    const invalidResult = service.validateCertificate(certificate.id, {
      status: 'closed',
      latencyMs: 250,
    });

    expect(validResult.integrityVerified).toBe(true);
    expect(invalidResult.integrityVerified).toBe(false);
  });
});
