import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import Groq from 'groq-sdk';
import { AnalysisRequestDto } from './dto/analysis.dto';

export type SignalType = 'bullish' | 'bearish' | 'neutral';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface TradingSignal {
  direction: SignalType;
  confidence: number; // 0–100
  rationale: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0–100 (higher = riskier)
  factors: string[];
}

export interface MarketAnalysis {
  marketId: string;
  marketTitle: string;
  summary: string;
  signal: TradingSignal;
  risk: RiskAssessment;
  keyInsights: string[];
  recommendation: string;
  generatedAt: string; // ISO timestamp
  model: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly groq: Groq | null;
  private readonly model = 'llama-3.3-70b-versatile';

  constructor(
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    const apiKey = this.config.get<string>('GROQ_API_KEY', '');
    this.groq = apiKey ? new Groq({ apiKey }) : null;
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY not set — AI analysis will use mock data');
    }
  }

  async analyzeMarket(dto: AnalysisRequestDto): Promise<MarketAnalysis> {
    const cacheKey = `ai:analysis:${dto.marketId}`;
    const cached = await this.cache.get<MarketAnalysis>(cacheKey);
    if (cached) return cached;

    const analysis = this.groq
      ? await this.fetchFromGroq(dto)
      : this.buildMockAnalysis(dto);

    await this.cache.set(cacheKey, analysis, CACHE_TTL_MS);
    return analysis;
  }

  async getCachedAnalysis(marketId: string): Promise<MarketAnalysis | null> {
    return this.cache.get<MarketAnalysis>(`ai:analysis:${marketId}`) ?? null;
  }

  private async fetchFromGroq(
    dto: AnalysisRequestDto,
  ): Promise<MarketAnalysis> {
    const prompt = this.buildPrompt(dto);

    const completion = await this.groq!.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a quantitative analyst specialising in prediction markets for flight operations. ' +
            'Respond ONLY with a valid JSON object matching the schema provided. No markdown, no prose.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    return this.parseGroqResponse(dto, raw);
  }

  private buildPrompt(dto: AnalysisRequestDto): string {
    return `Analyse this prediction market and return a JSON object with EXACTLY this shape:
{
  "summary": "<2-3 sentence market overview>",
  "signal": {
    "direction": "<bullish|bearish|neutral>",
    "confidence": <integer 0-100>,
    "rationale": "<one sentence>"
  },
  "risk": {
    "level": "<low|medium|high>",
    "score": <integer 0-100>,
    "factors": ["<factor 1>", "<factor 2>", "<factor 3>"]
  },
  "keyInsights": ["<insight 1>", "<insight 2>", "<insight 3>"],
  "recommendation": "<one actionable sentence>"
}

Market title: "${dto.marketTitle}"
${dto.marketDescription ? `Description: "${dto.marketDescription}"` : ''}
${dto.deadline ? `Resolution deadline: ${dto.deadline}` : ''}
${dto.currentOdds !== undefined ? `Current implied probability (0–1): ${dto.currentOdds}` : ''}
${dto.riskTolerance ? `Trader risk tolerance: ${dto.riskTolerance}` : ''}`;
  }

  private parseGroqResponse(
    dto: AnalysisRequestDto,
    raw: string,
  ): MarketAnalysis {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.logger.error('Failed to parse Groq JSON response', raw);
      return this.buildMockAnalysis(dto);
    }

    const signal = parsed.signal ?? {};
    const risk = parsed.risk ?? {};

    return {
      marketId: dto.marketId,
      marketTitle: dto.marketTitle,
      summary: String(parsed.summary ?? ''),
      signal: {
        direction: this.coerceSignal(signal.direction),
        confidence: this.clamp(Number(signal.confidence ?? 50), 0, 100),
        rationale: String(signal.rationale ?? ''),
      },
      risk: {
        level: this.coerceRisk(risk.level),
        score: this.clamp(Number(risk.score ?? 50), 0, 100),
        factors: Array.isArray(risk.factors) ? risk.factors.map(String) : [],
      },
      keyInsights: Array.isArray(parsed.keyInsights)
        ? parsed.keyInsights.map(String)
        : [],
      recommendation: String(parsed.recommendation ?? ''),
      generatedAt: new Date().toISOString(),
      model: this.model,
    };
  }

  private buildMockAnalysis(dto: AnalysisRequestDto): MarketAnalysis {
    return {
      marketId: dto.marketId,
      marketTitle: dto.marketTitle,
      summary:
        'This flight prediction market shows moderate activity with mixed signals from recent operational data. ' +
        'Historical on-time performance for this route suggests a slight lean toward the YES outcome. ' +
        'Weather and air-traffic conditions remain the primary variables to watch.',
      signal: {
        direction: 'bullish',
        confidence: 62,
        rationale:
          'Recent on-time rate for this carrier on this route exceeds the 60% threshold.',
      },
      risk: {
        level: 'medium',
        score: 45,
        factors: [
          'Weather uncertainty at destination airport',
          'Peak travel season congestion',
          'Limited historical data for this specific route',
        ],
      },
      keyInsights: [
        'Carrier has a 68% on-time rate over the past 30 days on similar routes.',
        'Departure airport is currently operating at 94% capacity.',
        'Market liquidity is sufficient for positions up to $500 USDC.',
      ],
      recommendation:
        'Consider a moderate YES position sized at 2–5% of portfolio given the medium risk profile.',
      generatedAt: new Date().toISOString(),
      model: 'mock',
    };
  }

  private coerceSignal(v: unknown): SignalType {
    if (v === 'bullish' || v === 'bearish' || v === 'neutral') return v;
    return 'neutral';
  }

  private coerceRisk(v: unknown): RiskLevel {
    if (v === 'low' || v === 'medium' || v === 'high') return v;
    return 'medium';
  }

  private clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, isNaN(n) ? min : n));
  }
}
