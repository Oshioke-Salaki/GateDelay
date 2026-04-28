import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/category.dto';
import { MarketResolverService } from '../markets/market-resolver.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private readonly marketResolverService: MarketResolverService,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    const { name, parentId } = createCategoryDto;

    if (parentId) {
      const parent = await this.categoryModel.findById(parentId);
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${parentId} not found`,
        );
      }
    }

    const category = new this.categoryModel({
      name,
      parentId: parentId ? new Types.ObjectId(parentId) : null,
    });

    return category.save();
  }

  async update(
    id: string,
    updateCategoryDto: Partial<CreateCategoryDto>,
  ): Promise<CategoryDocument> {
    const { parentId } = updateCategoryDto;

    if (parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }

    if (parentId) {
      const parent = await this.categoryModel.findById(parentId);
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${parentId} not found`,
        );
      }

      // Check for deeper circularity
      let currentParentId = parentId;
      while (currentParentId) {
        const currentParent = await this.categoryModel
          .findById(currentParentId)
          .lean();
        if (currentParent?.parentId?.toString() === id) {
          throw new BadRequestException(
            'Circular reference detected in category hierarchy',
          );
        }
        currentParentId = currentParent?.parentId?.toString() || null;
      }
    }

    const updated = await this.categoryModel.findByIdAndUpdate(
      id,
      { $set: updateCategoryDto },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Reassign children to the deleted category's parent
    await this.categoryModel.updateMany(
      { parentId: new Types.ObjectId(id) },
      { $set: { parentId: category.parentId } },
    );

    await this.categoryModel.deleteOne({ _id: new Types.ObjectId(id) });
  }

  async getTree(): Promise<any[]> {
    const allCategories = await this.categoryModel.find().lean();

    const buildTree = (parentId: string | null = null): any[] => {
      return allCategories
        .filter((cat) => {
          if (parentId === null) return cat.parentId === null;
          return cat.parentId?.toString() === parentId;
        })
        .map((cat) => ({
          id: cat._id,
          name: cat.name,
          popularity: cat.popularity,
          marketIds: cat.marketIds,
          children: buildTree(cat._id.toString()),
        }));
    };

    return buildTree(null);
  }

  async incrementPopularity(id: string): Promise<void> {
    const result = await this.categoryModel.updateOne(
      { _id: new Types.ObjectId(id) },
      { $inc: { popularity: 1 } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
  }

  async assignMarket(categoryId: string, marketId: string): Promise<void> {
    const result = await this.categoryModel.updateOne(
      { _id: new Types.ObjectId(categoryId) },
      { $addToSet: { marketIds: marketId } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }
    this.marketResolverService.updateMarketCategory(marketId, categoryId);
  }

  async getDescendantIds(categoryId: string): Promise<string[]> {
    const descendants: string[] = [categoryId];
    const children = await this.categoryModel
      .find({ parentId: new Types.ObjectId(categoryId) })
      .lean();

    for (const child of children) {
      const childDescendants = await this.getDescendantIds(
        child._id.toString(),
      );
      descendants.push(...childDescendants);
    }

    return [...new Set(descendants)];
  }

  async getMarketsByCategory(
    categoryId: string,
    includeChildren: boolean = true,
  ): Promise<any[]> {
    await this.incrementPopularity(categoryId);

    let marketIds: string[] = [];
    if (!includeChildren) {
      const category = await this.categoryModel.findById(categoryId).lean();
      if (!category)
        throw new NotFoundException(`Category ${categoryId} not found`);
      marketIds = category.marketIds;
    } else {
      const allRelatedCategoryIds = await this.getDescendantIds(categoryId);
      const categories = await this.categoryModel
        .find({
          _id: {
            $in: allRelatedCategoryIds.map((id) => new Types.ObjectId(id)),
          },
        })
        .lean();

      marketIds = categories.reduce((acc, cat) => {
        return [...acc, ...cat.marketIds];
      }, [] as string[]);
      marketIds = [...new Set(marketIds)];
    }

    return this.marketResolverService.getMarketsByIds(marketIds);
  }

  async findById(id: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(id);
    if (!category)
      throw new NotFoundException(`Category with ID ${id} not found`);
    return category;
  }
}
