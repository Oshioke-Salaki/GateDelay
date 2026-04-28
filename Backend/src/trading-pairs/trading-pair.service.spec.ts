import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TradingPairService } from './trading-pair.service';
import { TradingPair } from './schemas/trading-pair.schema';

describe('TradingPairService', () => {
  let service: TradingPairService;

  const mockTradingPairModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    exec: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingPairService,
        {
          provide: getModelToken(TradingPair.name),
          useValue: mockTradingPairModel,
        },
      ],
    }).compile();

    service = module.get<TradingPairService>(TradingPairService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatistics precision', () => {
    it('should calculate 24h stats with high precision without floating point errors', async () => {
      const mockPair = {
        _id: '1',
        volume24h: '100.000000000000000001',
        high24h: '10.0',
        low24h: '5.0',
      };

      mockTradingPairModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockPair),
      });

      mockTradingPairModel.findByIdAndUpdate.mockImplementation(
        (id, updateDto) => {
          return {
            exec: jest.fn().mockResolvedValue({ ...mockPair, ...updateDto }),
          };
        },
      );

      // Simulating a trade: currentPrice: '8.000000000000000001', openPrice: '4.000000000000000000'
      // addedVolume: '50.000000000000000001'
      const updatedPair = await service.updateStatistics(
        '1',
        '8.000000000000000001',
        '4.000000000000000000',
        '50.000000000000000001',
        false,
        false,
      );

      // mathjs validation
      // Change %: ((8.000000000000000001 - 4) / 4) * 100 = 100.000000000000000025
      expect(updatedPair.priceChangePercent24h).toBe('100.000000000000000025');
      // Volume: 100.000000000000000001 + 50.000000000000000001 = 150.000000000000000002
      expect(updatedPair.volume24h).toBe('150.000000000000000002');
      expect(updatedPair.high24h).toBe('10.0');
      expect(updatedPair.low24h).toBe('5.0');
    });
  });
});
