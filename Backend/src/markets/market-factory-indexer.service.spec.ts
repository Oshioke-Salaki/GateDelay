import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import { MarketResolverService } from './market-resolver.service';
import { MarketFactoryIndexerService } from './market-factory-indexer.service';
import { MarketFactoryCheckpointDocument } from './schemas/market.schema';
import type { Model } from 'mongoose';

describe('MarketFactoryIndexerService', () => {
  const factoryAddress = '0x0000000000000000000000000000000000000001';
  const deployment = {
    name: 'MarketFactory',
    address: factoryAddress,
    chainId: 5000,
    abiVersion: '1.0.0',
  };

  it('replays an uncheckpointed range after interrupted event processing', async () => {
    const checkpointRecords = new Map<string, Record<string, unknown>>();
    const checkpointQuery = <T>(resolve: () => Promise<T>) => {
      let chain: {
        lean: () => typeof chain;
        exec: () => Promise<T>;
      };
      chain = {
        lean: () => chain,
        exec: resolve,
      };
      return chain;
    };
    const checkpointModel = {
      createIndexes: jest.fn().mockResolvedValue(undefined),
      findOneAndUpdate: jest.fn(
        ({ id }: { id: string }, update: { $setOnInsert: Record<string, unknown> }) =>
          checkpointQuery(async () => {
            if (!checkpointRecords.has(id)) {
              checkpointRecords.set(id, update.$setOnInsert);
            }
            return checkpointRecords.get(id);
          }),
      ),
      updateOne: jest.fn(
        ({ id }: { id: string }, update: { $max: { lastProcessedBlock: number } }) => ({
          exec: jest.fn(async () => {
            const checkpoint = checkpointRecords.get(id);
            if (!checkpoint) return { matchedCount: 0 };
            checkpointRecords.set(id, {
              ...checkpoint,
              lastProcessedBlock: Math.max(
                Number(checkpoint.lastProcessedBlock),
                update.$max.lastProcessedBlock,
              ),
            });
            return { matchedCount: 1 };
          }),
        }),
      ),
    };

    const eventLog = {
      blockNumber: 10,
      index: 0,
    } as unknown as ethers.Log;
    const provider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: 5000n }),
      getBlockNumber: jest.fn().mockResolvedValue(2002),
      getLogs: jest.fn(async ({ fromBlock }: { fromBlock: number }) =>
        fromBlock === 0 ? [eventLog] : [],
      ),
    };
    const blockchain = {
      getDeployedContracts: jest.fn().mockReturnValue([deployment]),
      getProvider: jest.fn().mockReturnValue(provider),
    };
    const marketResolver = {
      registerDiscoveredMarket: jest.fn().mockResolvedValue(true),
    };
    const indexer = new MarketFactoryIndexerService(
      { get: jest.fn().mockReturnValue(0) } as never,
      blockchain as unknown as BlockchainService,
      marketResolver as unknown as MarketResolverService,
      checkpointModel as unknown as Model<MarketFactoryCheckpointDocument>,
    );
    const internals = indexer as unknown as {
      indexEvent: (...args: unknown[]) => Promise<void>;
    };
    const processEvent = jest
      .spyOn(internals, 'indexEvent')
      .mockRejectedValueOnce(new Error('temporary database failure'))
      .mockResolvedValue(undefined);

    await indexer.sync();
    expect(checkpointRecords.get(`5000:${factoryAddress}`)?.lastProcessedBlock).toBe(-1);

    await indexer.sync();
    expect(checkpointRecords.get(`5000:${factoryAddress}`)?.lastProcessedBlock).toBe(2000);
    expect(processEvent).toHaveBeenCalledTimes(2);
    expect(provider.getLogs).toHaveBeenCalledTimes(4);
  });
});
