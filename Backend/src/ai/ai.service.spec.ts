import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { AnalysisRequestDto } from './dto/analysis.dto';

const mockCreate = jest.fn();

jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

describe('AiService', () => {
  const dto: AnalysisRequestDto = {
    marketId: 'market-1',
    marketTitle: 'Will Flight GD123 arrive on time?',
    socialSignals: 'Mostly positive traveler reports',
    newsSignals: 'No weather disruption reported',
    tradingSignals: 'Stable volume',
  };

  const buildService = (apiKey = 'groq-key') => {
    const store = new Map<string, unknown>();
    const cache = {
      get: jest.fn((key: string) => Promise.resolve(store.get(key))),
      set: jest.fn((key: string, value: unknown) => {
        store.set(key, value);
        return Promise.resolve();
      }),
    };
    const config = {
      get: jest.fn((_key: string, fallback = '') => apiKey || fallback),
    } as unknown as ConfigService;

    return { service: new AiService(config, cache as any), cache };
  };

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns normalized provider analysis for valid inputs', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: 'Signals lean toward on-time arrival.',
              signal: {
                direction: 'bullish',
                confidence: 84,
                rationale: 'Provider signals agree.',
              },
              risk: {
                level: 'low',
                score: 21,
                factors: ['low disruption'],
                reasons: ['clear weather'],
                confidence: 88,
                inputSignals: [{ signal: 'news', value: 'positive' }],
              },
              keyInsights: ['Weather is clear'],
              recommendation: 'Consider a small YES position.',
            }),
          },
        },
      ],
    });
    const { service, cache } = buildService();

    const result = await service.analyzeMarket(dto);

    expect(result.signal.direction).toBe('bullish');
    expect(result.signal.confidence).toBe(84);
    expect(result.risk.level).toBe('low');
    expect(cache.set).toHaveBeenCalledWith(
      'ai:analysis:market-1',
      expect.objectContaining({ marketId: 'market-1' }),
      expect.any(Number),
    );
  });

  it('falls back to mock analysis when provider data is malformed', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '{not-json' } }],
    });
    const { service } = buildService();

    const result = await service.analyzeMarket(dto);

    expect(result.model).toBe('mock');
    expect(result.marketId).toBe(dto.marketId);
    expect(result.keyInsights.length).toBeGreaterThan(0);
  });

  it('surfaces provider failures so callers can fail closed', async () => {
    mockCreate.mockRejectedValue(new Error('provider unavailable'));
    const { service } = buildService();

    await expect(service.analyzeMarket(dto)).rejects.toThrow(
      'provider unavailable',
    );
  });

  it('returns null for an empty cached sentiment result set', async () => {
    const { service } = buildService('');

    await expect(service.getCachedAnalysis('unknown-market')).resolves.toBeNull();
  });

  it('builds mock analysis for empty optional signal inputs', async () => {
    const { service } = buildService('');

    const result = await service.analyzeMarket({
      marketId: 'market-empty',
      marketTitle: 'Sparse market',
    });

    expect(result.model).toBe('mock');
    expect(result.signal.direction).toBeDefined();
    expect(result.risk.factors.length).toBeGreaterThan(0);
  });
});
