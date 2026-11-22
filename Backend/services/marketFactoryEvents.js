const { EventEmitter } = require('events');
const { JsonRpcProvider, Contract } = require('ethers');

const MARKET_FACTORY_ABI = [
  'event MarketCreated(address indexed market, address indexed creator, address indexed collateralToken, uint256 resolutionDeadline)',
];

const COMPONENT_ID = 'market-factory';
const MAX_LOOKBACK_BLOCKS = 1000;

function resolveOptions(options = {}) {
  return {
    service: options.service || null,
    io: options.io || null,
    logger: options.logger || console,
    rpcUrl:
      options.rpcUrl ||
      process.env.RPC_URL ||
      process.env.BLOCKCHAIN_RPC_URL ||
      'http://127.0.0.1:8545',
    contractAddress:
      options.contractAddress ||
      process.env.MARKET_FACTORY_ADDRESS ||
      process.env.MARKET_FACTORY_CONTRACT_ADDRESS ||
      process.env.MARKET_CONTRACT_ADDRESS ||
      '',
    pollIntervalMs: options.pollIntervalMs != null ? options.pollIntervalMs : 15000,
    fromBlock: options.fromBlock != null ? options.fromBlock : null,
  };
}

class MarketFactoryEventsWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    const config = resolveOptions(options);
    this.service = config.service;
    this.io = config.io;
    this.logger = config.logger;
    this.rpcUrl = config.rpcUrl;
    this.contractAddress = config.contractAddress;
    this.pollIntervalMs = config.pollIntervalMs;
    this.fromBlock = config.fromBlock;
    this._running = false;
    this._provider = null;
    this._contract = null;
    this._timer = null;
    this._lastBlock = null;
    this._lastError = null;
    this._eventsSeen = 0;
  }

  async _registerComponent() {
    if (!this.service) return;
    try {
      await this.service.registerComponent(
        COMPONENT_ID,
        { contractAddress: this.contractAddress, rpcUrl: this.rpcUrl },
        this.pollIntervalMs,
      );
    } catch (err) {
      this.logger.warn(`[MarketFactoryEvents] registerComponent failed: ${err.message}`);
    }
  }

  async _connect() {
    this._provider = new JsonRpcProvider(this.rpcUrl);
    this._provider.on('error', (err) => {
      this._lastError = err;
      this.logger.warn(`[MarketFactoryEvents] RPC error: ${err.message}`);
    });
    this._contract = new Contract(this.contractAddress, MARKET_FACTORY_ABI, this._provider);
    const current = await this._provider.getBlockNumber();
    if (this._lastBlock == null) {
      this._lastBlock =
        this.fromBlock != null
          ? this.fromBlock
          : Math.max(0, current - MAX_LOOKBACK_BLOCKS);
    }
    this.logger.info(`[MarketFactoryEvents] watching ${this.contractAddress} on ${this.rpcUrl} (block ${current})`);
  }

  async start() {
    if (this._running) {
      return { started: true, alreadyRunning: true };
    }
    if (!this.contractAddress) {
      this.logger.warn(
        '[MarketFactoryEvents] MARKET_FACTORY_ADDRESS not configured; MarketFactory events will not be forwarded to the heartbeat system.',
      );
      this.emit('skipped', { reason: 'missing MARKET_FACTORY_ADDRESS' });
      return { started: false, reason: 'missing MARKET_FACTORY_ADDRESS' };
    }

    this._running = true;
    try {
      await this._connect();
    } catch (err) {
      this._lastError = err;
      this.logger.warn(
        `[MarketFactoryEvents] RPC ${this.rpcUrl} unreachable (${err.message}); will keep retrying every ${this.pollIntervalMs}ms`,
      );
      this._provider = null;
      this._contract = null;
    }

    await this._registerComponent();

    this._timer = setInterval(() => {
      this.poll().catch((err) => {
        this._lastError = err;
        this.logger.warn(`[MarketFactoryEvents] poll failed: ${err.message}`);
      });
    }, this.pollIntervalMs);
    if (this._timer.unref) {
      this._timer.unref();
    }

    this.poll().catch((err) => {
      this._lastError = err;
      this.logger.warn(`[MarketFactoryEvents] initial poll failed: ${err.message}`);
    });

    this.emit('started', { rpcUrl: this.rpcUrl, contractAddress: this.contractAddress });
    return { started: true };
  }

  async poll() {
    if (!this._running) return [];
    if (!this._contract || !this._provider) {
      try {
        await this._connect();
      } catch (err) {
        this._lastError = err;
        return [];
      }
    }

    let current;
    try {
      current = await this._provider.getBlockNumber();
    } catch (err) {
      this._lastError = err;
      this.logger.warn(`[MarketFactoryEvents] getBlockNumber failed: ${err.message}`);
      return [];
    }

    const from = this._lastBlock != null ? this._lastBlock + 1 : Math.max(0, current - MAX_LOOKBACK_BLOCKS);
    if (from > current) {
      this._lastBlock = current;
      return [];
    }

    let logs = [];
    try {
      logs = await this._contract.queryFilter('MarketCreated', from, current);
    } catch (err) {
      this._lastError = err;
      this.logger.warn(`[MarketFactoryEvents] queryFilter failed (${err.message}); skipping cycle`);
      return [];
    }

    const events = [];
    for (const log of logs) {
      const event = {
        market: log.args.market,
        creator: log.args.creator,
        collateralToken: log.args.collateralToken,
        resolutionDeadline: log.args.resolutionDeadline ? log.args.resolutionDeadline.toString() : '0',
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
      };
      events.push(event);
      this._eventsSeen += 1;
      this.emit('marketCreated', event);

      if (this.io) {
        this.io.emit('market:created', { componentId: COMPONENT_ID, event });
      }

      if (this.service) {
        try {
          await this.service.beat(COMPONENT_ID, {
            market: event.market,
            creator: event.creator,
            collateralToken: event.collateralToken,
            resolutionDeadline: event.resolutionDeadline,
            blockNumber: event.blockNumber,
          });
        } catch (err) {
          this.logger.warn(`[MarketFactoryEvents] beat failed: ${err.message}`);
        }
      }
    }

    this._lastBlock = current;
    return events;
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.emit('stopped');
  }

  status() {
    return {
      running: this._running,
      rpcUrl: this.rpcUrl,
      contractAddress: this.contractAddress,
      lastBlock: this._lastBlock,
      eventsSeen: this._eventsSeen,
      lastError: this._lastError ? this._lastError.message : null,
    };
  }
}

function createMarketFactoryWatcher(options = {}) {
  return new MarketFactoryEventsWatcher(options);
}

module.exports = {
  MarketFactoryEventsWatcher,
  createMarketFactoryWatcher,
  MARKET_FACTORY_ABI,
  COMPONENT_ID,
};