import { NotFoundException } from '@nestjs/common';
import { MarketsController } from './markets.controller';

describe('MarketsController', () => {
  let controller: MarketsController;
  let resolver: any;
  let cache: any;
  let blockchain: any;

  beforeEach(() => {
    resolver = {
      getAllMarkets: jest.fn(),
      getMarket: jest.fn(),
    };
    cache = {
      getOrSet: jest.fn((_key, loader) => loader()),
    };
    blockchain = {
      getDeployedContract: jest.fn(),
    };
    controller = new MarketsController(resolver, cache, blockchain);
  });

  it('returns market metadata, deployment identity, outcomes, and lifecycle', async () => {
    resolver.getMarket.mockReturnValue({
      id: 'm-1',
      title: 'BTC / USD',
      categoryId: 'crypto',
      deadline: new Date('2024-01-05T00:00:00.000Z'),
      totalYesStake: 10n,
      totalNoStake: 2n,
      status: 'resolved',
      outcome: 'YES',
      resolvedAt: new Date('2024-01-10T00:00:00.000Z'),
    });
    blockchain.getDeployedContract.mockReturnValue({
      address: '0x0000000000000000000000000000000000000001',
      chainId: 5000,
      abiVersion: '1',
    });

    await expect(controller.getById('m-1')).resolves.toEqual({
      success: true,
      data: {
        id: 'm-1',
        metadata: {
          title: 'BTC / USD',
          description: null,
          categoryId: 'crypto',
          deadline: '2024-01-05T00:00:00.000Z',
        },
        deployment: {
          marketId: 'm-1',
          contractName: 'MarketMaker',
          contractAddress: '0x0000000000000000000000000000000000000001',
          factoryAddress: null,
          creator: null,
          collateralToken: null,
          chainId: 5000,
          abiVersion: '1',
          factoryAbiVersion: null,
        },
        outcomes: {
          yes: { totalStake: '10' },
          no: { totalStake: '2' },
          result: 'YES',
        },
        lifecycle: {
          status: 'resolved',
          resolvedAt: '2024-01-10T00:00:00.000Z',
        },
      },
    });
  });

  it('returns an explicit 404 for an unknown market', async () => {
    resolver.getMarket.mockReturnValue(undefined);

    await expect(controller.getById('missing')).rejects.toThrow(NotFoundException);
    expect(blockchain.getDeployedContract).not.toHaveBeenCalled();
  });

  it('returns resolved and cancelled markets with archive metadata', async () => {
    resolver.getAllMarkets.mockReturnValue([
      {
        id: 'm-1',
        title: 'BTC / USD',
        description: 'Market for Bitcoin',
        categoryId: 'crypto',
        status: 'resolved',
        outcome: 'YES',
        resolvedAt: new Date('2024-01-10T00:00:00.000Z'),
        createdAt: new Date('2023-12-01T00:00:00.000Z'),
        deadline: new Date('2024-01-05T00:00:00.000Z'),
        totalYesStake: 10n,
        totalNoStake: 2n,
      },
      {
        id: 'm-2',
        title: 'ETH / USD',
        description: 'Market for Ethereum',
        categoryId: 'crypto',
        status: 'active',
        deadline: new Date('2024-02-01T00:00:00.000Z'),
        totalYesStake: 8n,
        totalNoStake: 3n,
      },
      {
        id: 'm-3',
        title: 'Cancelled test',
        description: 'Cancelled outcome',
        categoryId: 'politics',
        status: 'cancelled',
        outcome: 'VOID',
        resolvedAt: new Date('2024-01-15T00:00:00.000Z'),
        createdAt: new Date('2023-12-10T00:00:00.000Z'),
        deadline: new Date('2024-01-12T00:00:00.000Z'),
        totalYesStake: 5n,
        totalNoStake: 0n,
      },
    ]);

    const result = await controller.getArchive({
      category: 'crypto',
      outcome: 'yes',
      from: '2024-01-01T00:00:00.000Z',
      to: '2024-01-31T00:00:00.000Z',
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'm-1',
      title: 'BTC / USD',
      category: 'crypto',
      resolvedOutcome: 'yes',
      volume: 12,
      participants: 0,
    });
    expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10 });
  });

  it('supports pagination and ignores malformed archive rows safely', async () => {
    resolver.getAllMarkets.mockReturnValue([
      {
        id: 'm-1',
        title: 'A',
        description: 'x',
        categoryId: 'crypto',
        status: 'resolved',
        outcome: 'YES',
        resolvedAt: new Date('2024-01-05T00:00:00.000Z'),
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        deadline: new Date('2024-01-04T00:00:00.000Z'),
        totalYesStake: 1n,
        totalNoStake: 0n,
      },
      {
        id: 'm-2',
        title: 'B',
        description: 'x',
        categoryId: 'crypto',
        status: 'resolved',
        outcome: 'NO',
        resolvedAt: new Date('2024-01-06T00:00:00.000Z'),
        createdAt: new Date('2023-01-02T00:00:00.000Z'),
        deadline: new Date('2024-01-05T00:00:00.000Z'),
        totalYesStake: 0n,
        totalNoStake: 2n,
      },
      null,
    ]);

    const result = await controller.getArchive({ page: 2, limit: 1 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('m-2');
    expect(result.meta).toMatchObject({ page: 2, limit: 1, total: 2 });
  });
});
