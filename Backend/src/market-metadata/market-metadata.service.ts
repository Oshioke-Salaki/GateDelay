import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  MarketMetadata,
  MarketMetadataDocument,
} from './schemas/market-metadata.schema';
import {
  CreateMarketMetadataDto,
  UpdateMarketMetadataDto,
  SearchMarketMetadataDto,
} from './dto/market-metadata.dto';

@Injectable()
export class MarketMetadataService {
  private readonly logger = new Logger(MarketMetadataService.name);

  constructor(
    @InjectModel(MarketMetadata.name)
    private readonly metadataModel: Model<MarketMetadataDocument>,
  ) {}

  async create(dto: CreateMarketMetadataDto): Promise<MarketMetadata> {
    const existing = await this.metadataModel
      .findOne({ marketId: dto.marketId })
      .sort({ version: -1 });

    if (existing) {
      throw new ConflictException(
        `Metadata for market ${dto.marketId} already exists. Use update to create a new version.`,
      );
    }

    const metadata = new this.metadataModel({ ...dto, version: 1 });
    await metadata.save();
    this.logger.log(`Created metadata for market ${dto.marketId}`);
    return metadata;
  }

  async findByMarketId(marketId: string): Promise<MarketMetadata> {
    const metadata = await this.metadataModel
      .findOne({ marketId, isActive: true })
      .sort({ version: -1 });

    if (!metadata) {
      throw new NotFoundException(`Metadata for market ${marketId} not found`);
    }
    return metadata;
  }

  async findVersions(marketId: string): Promise<MarketMetadata[]> {
    return this.metadataModel
      .find({ marketId })
      .sort({ version: -1 })
      .exec();
  }

  async update(
    marketId: string,
    dto: UpdateMarketMetadataDto,
  ): Promise<MarketMetadata> {
    const current = await this.metadataModel
      .findOne({ marketId, isActive: true })
      .sort({ version: -1 });

    if (!current) {
      throw new NotFoundException(`Metadata for market ${marketId} not found`);
    }

    // Create a new version
    const newVersion = new this.metadataModel({
      marketId,
      name: dto.name ?? current.name,
      description: dto.description ?? current.description,
      attributes: dto.attributes ?? current.attributes,
      category: dto.category ?? current.category,
      tags: dto.tags ?? current.tags,
      isActive: dto.isActive ?? current.isActive,
      version: current.version + 1,
    });

    await newVersion.save();
    this.logger.log(
      `Created version ${newVersion.version} for market ${marketId}`,
    );
    return newVersion;
  }

  async remove(marketId: string): Promise<void> {
    const result = await this.metadataModel.updateMany(
      { marketId },
      { isActive: false },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException(`Metadata for market ${marketId} not found`);
    }
    this.logger.log(`Deactivated metadata for market ${marketId}`);
  }

  async search(dto: SearchMarketMetadataDto): Promise<{
    data: MarketMetadata[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: Record<string, unknown> = {};

    if (dto.isActive !== undefined) filter.isActive = dto.isActive;
    else filter.isActive = true;

    if (dto.category) filter.category = dto.category;
    if (dto.tags?.length) filter.tags = { $in: dto.tags };
    if (dto.query) filter.$text = { $search: dto.query };

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.metadataModel
        .find(filter)
        .sort({ version: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.metadataModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async validateSchema(
    marketId: string,
    schema: Record<string, unknown>,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const metadata = await this.metadataModel
      .findOne({ marketId, isActive: true })
      .sort({ version: -1 });

    if (!metadata) {
      throw new NotFoundException(`Metadata for market ${marketId} not found`);
    }

    const errors: string[] = [];
    for (const [key, type] of Object.entries(schema)) {
      const val = (metadata.attributes as Record<string, unknown>)[key];
      if (val === undefined) {
        errors.push(`Missing required attribute: ${key}`);
      } else if (typeof val !== type) {
        errors.push(`Attribute ${key} expected ${String(type)}, got ${typeof val}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
