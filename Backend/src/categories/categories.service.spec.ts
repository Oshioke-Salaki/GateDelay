import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CategoriesService } from './categories.service';
import { Category } from './schemas/category.schema';
import { MarketResolverService } from '../markets/market-resolver.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let model: any;
  let marketResolver: any;

  const mockCategory = {
    _id: new Types.ObjectId(),
    name: 'Tech',
    parentId: null,
    popularity: 0,
    marketIds: ['m1'],
    save: jest.fn().mockResolvedValue({ _id: 'new_id', name: 'New Cat' }),
  };

  const mockCategoryModel = {
    new: jest.fn().mockImplementation(() => mockCategory),
    constructor: jest.fn().mockImplementation(() => mockCategory),
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    lean: jest.fn(),
    save: jest.fn(),
  };

  // Mocking the model constructor for 'new this.categoryModel'
  function MockModel(dto: any) {
    this.name = dto.name;
    this.parentId = dto.parentId;
    this.save = jest
      .fn()
      .mockResolvedValue({ _id: new Types.ObjectId(), ...dto });
  }

  const mockMarketResolverService = {
    getMarketsByIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getModelToken(Category.name),
          useValue: MockModel,
        },
        {
          provide: MarketResolverService,
          useValue: mockMarketResolverService,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    // Overwrite the model with a more controllable mock for find/findById
    (service as any).categoryModel = {
      find: jest.fn(),
      findById: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      deleteOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };
    model = (service as any).categoryModel;
    marketResolver = mockMarketResolverService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTree', () => {
    it('should return a nested tree', async () => {
      const id1 = '123456789012123456789011';
      const id2 = '123456789012123456789012';
      const cats = [
        {
          _id: id1,
          name: 'Parent',
          parentId: null,
          popularity: 0,
          marketIds: [],
        },
        {
          _id: id2,
          name: 'Child',
          parentId: id1,
          popularity: 0,
          marketIds: [],
        },
      ];
      model.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(cats),
      });

      const tree = await service.getTree();
      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Parent');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('Child');
    });
  });

  describe('incrementPopularity', () => {
    it('should increment popularity', async () => {
      model.updateOne.mockResolvedValue({ matchedCount: 1 });
      await service.incrementPopularity('123456789012123456789012');
      expect(model.updateOne).toHaveBeenCalledWith(
        { _id: expect.any(Types.ObjectId) },
        { $inc: { popularity: 1 } },
      );
    });

    it('should throw NotFoundException if category not found', async () => {
      model.updateOne.mockResolvedValue({ matchedCount: 0 });
      await expect(
        service.incrementPopularity('123456789012123456789012'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMarketsByCategory', () => {
    it('should return markets from category and its descendants', async () => {
      const categoryId = '123456789012123456789012';
      const childId = '123456789012123456789013';

      model.updateOne.mockResolvedValue({ matchedCount: 1 });

      // Mock getDescendantIds behavior
      // find for descendants of categoryId
      model.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([{ _id: childId }]),
      });
      // find for descendants of childId
      model.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([]),
      });

      // find for all categories in [categoryId, childId]
      model.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([
          { _id: categoryId, marketIds: ['m1'] },
          { _id: childId, marketIds: ['m2'] },
        ]),
      });

      marketResolver.getMarketsByIds.mockReturnValue([
        { id: 'm1' },
        { id: 'm2' },
      ]);

      const markets = await service.getMarketsByCategory(categoryId);
      expect(markets).toHaveLength(2);
      expect(marketResolver.getMarketsByIds).toHaveBeenCalledWith(
        expect.arrayContaining(['m1', 'm2']),
      );
    });
  });

  describe('update', () => {
    it('should throw BadRequestException if category is its own parent', async () => {
      const id = '123456789012123456789012';
      await expect(service.update(id, { parentId: id })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should detect circular references', async () => {
      const id = '123456789012123456789011';
      const parentId = '123456789012123456789012';

      // Mock findById for parent check
      model.findById.mockReturnValueOnce({ _id: parentId });

      // Mock findById for circularity check (the while loop)
      model.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ _id: parentId, parentId: id }),
      });

      await expect(service.update(id, { parentId: parentId })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('delete', () => {
    it('should reassign children before deleting', async () => {
      const id = '123456789012123456789011';
      const parentId = '123456789012123456789010';
      model.findById.mockResolvedValue({ _id: id, parentId: parentId });
      model.updateMany.mockResolvedValue({ matchedCount: 1 });
      model.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.delete(id);

      expect(model.updateMany).toHaveBeenCalledWith(
        { parentId: expect.any(Types.ObjectId) },
        { $set: { parentId: parentId } },
      );
      expect(model.deleteOne).toHaveBeenCalledWith({
        _id: expect.any(Types.ObjectId),
      });
    });
  });
});
