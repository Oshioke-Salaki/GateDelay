const assert = require('node:assert');

async function main() {
  const quietLogger = { info() {}, warn() {}, error() {}, log() {} };

  const watcherModule = require('../../services/marketFactoryEvents');
  assert.strictEqual(typeof watcherModule.createMarketFactoryWatcher, 'function');
  assert.strictEqual(typeof watcherModule.MarketFactoryEventsWatcher, 'function');
  assert.ok(Array.isArray(watcherModule.MARKET_FACTORY_ABI));

  const missing = watcherModule.createMarketFactoryWatcher({
    contractAddress: '',
    logger: quietLogger,
  });
  const skipped = await missing.start();
  assert.strictEqual(skipped.started, false, 'watcher must skip cleanly without a contract address');

  const enabled = watcherModule.createMarketFactoryWatcher({
    contractAddress: '0x0000000000000000000000000000000000000001',
    rpcUrl: 'http://127.0.0.1:1',
    logger: quietLogger,
  });
  const started = await enabled.start();
  assert.strictEqual(started.started, true, 'watcher must start and retry when the RPC is down');
  assert.strictEqual(typeof enabled.status, 'function');
  enabled.stop();

  const heartbeatModule = require('../../heartbeatServer');
  assert.strictEqual(typeof heartbeatModule.startHeartbeatServer, 'function');
  assert.strictEqual(typeof heartbeatModule.stopHeartbeatServer, 'function');
  assert.ok(heartbeatModule.marketFactoryWatcher, 'heartbeat server must expose a MarketFactory watcher');
  assert.ok(heartbeatModule.service, 'heartbeat server must expose the HeartbeatService');

  console.log('HEARTBEAT_MARKETFACTORY_SMOKE_PASS');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });