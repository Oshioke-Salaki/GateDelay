import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TradingPair,
  TradingPairDocument,
  TradingPairStatus,
} from './schemas/trading-pair.schema';
import { CreateTradingPairDto } from './dto/create-trading-pair.dto';
import { UpdateTradingPairDto } from './dto/update-trading-pair.dto';
import * as math from 'mathjs';

@Injectable()
export class TradingPairService {
  private readonly logger = new Logger(TradingPairService.name);

  constructor(
    @InjectModel(TradingPair.name)
    private tradingPairModel: Model<TradingPairDocument>,
  ) {}

  async create(createDto: CreateTradingPairDto): Promise<TradingPair> {
    if (createDto.baseAsset === createDto.quoteAsset) {
      throw new ConflictException(
        'Base asset and quote asset cannot be the same',
      );
    }

    try {
      const createdPair = new this.tradingPairModel(createDto);
      return await createdPair.save();
    } catch (error: any) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        throw new ConflictException('Trading pair already exists');
      }
      throw error;
    }
  }

  async findAll(status?: TradingPairStatus): Promise<TradingPair[]> {
    const query = status ? { status } : {};
    return this.tradingPairModel.find(query).exec();
  }

  async findOne(id: string): Promise<TradingPair> {
    const pair = await this.tradingPairModel.findById(id).exec();
    if (!pair) {
      throw new NotFoundException(`Trading pair #${id} not found`);
    }
    return pair;
  }

  async findByAssets(
    baseAsset: string,
    quoteAsset: string,
  ): Promise<TradingPair> {
    const pair = await this.tradingPairModel
      .findOne({ baseAsset, quoteAsset })
      .exec();
    if (!pair) {
      throw new NotFoundException(
        `Trading pair ${baseAsset}/${quoteAsset} not found`,
      );
    }
    return pair;
  }

  async update(
    id: string,
    updateDto: UpdateTradingPairDto,
  ): Promise<TradingPair> {
    const existingPair = await this.tradingPairModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();

    if (!existingPair) {
      throw new NotFoundException(`Trading pair #${id} not found`);
    }
    return existingPair;
  }

  async updateStatus(
    id: string,
    status: TradingPairStatus,
  ): Promise<TradingPair> {
    return this.update(id, { status });
  }

  // --- Statistics Calculation Logic ---

  /**
   * Updates the 24h statistics for a trading pair using high-precision math.
   * This would typically be called by a cron job or message consumer processing trades.
   */
  async updateStatistics(
    id: string,
    currentPriceStr: string,
    openPrice24hStr: string,
    addedVolumeStr: string,
    isNewHigh: boolean,
    isNewLow: boolean,
  ): Promise<TradingPair> {
    const pair = await this.findOne(id);

    // Use mathjs to calculate change percentage: ((Current - Open) / Open) * 100
    let priceChangePercent = '0';
    try {
      const current = math.bignumber(currentPriceStr);
      const open = math.bignumber(openPrice24hStr);

      if (!math.equal(open, 0)) {
        const diff = math.subtract(current, open);
        const ratio = math.divide(diff, open);
        priceChangePercent = math.format(math.multiply(ratio, 100), {
          notation: 'fixed',
        });
      }
    } catch (e) {
      this.logger.error(`Error calculating price change for ${id}:`, e);
    }

    // Accumulate volume
    let newVolume = pair.volume24h;
    try {
      const currentVol = math.bignumber(pair.volume24h || '0');
      const addedVol = math.bignumber(addedVolumeStr || '0');
      newVolume = math.format(math.add(currentVol, addedVol), {
        notation: 'fixed',
      });
    } catch (e) {
      this.logger.error(`Error calculating volume for ${id}:`, e);
    }

    // Update highs/lows
    let newHigh = pair.high24h;
    let newLow = pair.low24h;

    try {
      if (
        isNewHigh ||
        math.larger(
          math.bignumber(currentPriceStr),
          math.bignumber(pair.high24h || '0'),
        )
      ) {
        newHigh = currentPriceStr;
      }

      const currentLowBig = math.bignumber(pair.low24h || '0');
      if (
        isNewLow ||
        math.equal(currentLowBig, 0) ||
        math.smaller(math.bignumber(currentPriceStr), currentLowBig)
      ) {
        newLow = currentPriceStr;
      }
    } catch (e) {
      this.logger.error(`Error calculating high/low for ${id}:`, e);
    }

    return this.update(id, {
      lastPrice: currentPriceStr,
      openPrice24h: openPrice24hStr,
      priceChangePercent24h: priceChangePercent,
      volume24h: newVolume,
      high24h: newHigh,
      low24h: newLow,
    });
  }
}
