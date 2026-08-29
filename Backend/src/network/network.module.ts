/**
 * @file network.module.ts
 * @module NetworkModule
 * @description NestJS feature module that wires the network-switching
 *   subsystem for GateDelay.
 *
 * ---------------------------------------------------------------------------
 * BOOT DEPENDENCY DOCUMENTATION  (issue #589)
 * ---------------------------------------------------------------------------
 *
 * Boot order & dependencies
 * -------------------------
 * NetworkModule is a **self-contained** module — it has no Mongoose models,
 * no external HTTP clients, and no Redis dependency at startup.  It can
 * therefore be bootstrapped before the async infrastructure modules
 * (MongooseModule, CacheModule) finish initialising.
 *
 * Startup sequence inside AppModule:
 *   1. ConfigModule  — loads .env / environment variables (isGlobal: true)
 *   2. NetworkModule — reads optional env vars for RPC URLs and contract
 *                      addresses (MAINNET_RPC_URL, TESTNET_RPC_URL, etc.)
 *                      via NetworkService.initializeNetworks().  All vars
 *                      have safe defaults so the app boots even without them.
 *   3. All other feature modules — may inject NetworkService as a dependency
 *      via the `exports: [NetworkService]` declaration below.
 *
 * Environment variables consumed at boot (all optional)
 * ------------------------------------------------------
 * | Variable                     | Default fallback                         |
 * |------------------------------|------------------------------------------|
 * | MAINNET_RPC_URL              | https://eth-mainnet.g.alchemy.com/v2/demo|
 * | TESTNET_RPC_URL              | https://eth-goerli.g.alchemy.com/v2/demo |
 * | POLYGON_RPC_URL              | https://polygon-rpc.com                  |
 * | MAINNET_MARKET_ADDRESS       | 0x000…0001                               |
 * | MAINNET_TRADING_ADDRESS      | 0x000…0002                               |
 * | MAINNET_LIQUIDITY_ADDRESS    | 0x000…0003                               |
 * | MAINNET_COLLATERAL_ADDRESS   | 0x000…0004                               |
 * | TESTNET_MARKET_ADDRESS       | 0x000…0005                               |
 * | TESTNET_TRADING_ADDRESS      | 0x000…0006                               |
 * | TESTNET_LIQUIDITY_ADDRESS    | 0x000…0007                               |
 * | TESTNET_COLLATERAL_ADDRESS   | 0x000…0008                               |
 * | POLYGON_MARKET_ADDRESS       | 0x000…0009                               |
 * | POLYGON_TRADING_ADDRESS      | 0x000…0010                               |
 * | POLYGON_LIQUIDITY_ADDRESS    | 0x000…0011                               |
 * | POLYGON_COLLATERAL_ADDRESS   | 0x000…0012                               |
 *
 * Local build/run path
 * --------------------
 * ```bash
 * cd Backend
 * cp .env.example .env          # set real RPC URLs for non-default behaviour
 * npm install
 * npm run start:dev             # NestJS dev server with hot-reload
 * # or for production:
 * npm run build && npm run start:prod
 * ```
 *
 * NetworkModule registers the following HTTP endpoints on boot:
 *   GET  /network/current
 *   POST /network/switch/:networkName
 *   GET  /network/config/:networkName
 *   GET  /network/all
 *   GET  /network/health/:networkName
 *   GET  /network/health
 *   POST /network/contract-address/:networkName
 *   GET  /network/switch-history
 *
 * Phase 2 dependency note
 * -----------------------
 * When real on-chain health checks replace the simulated latency in
 * NetworkService.checkNetworkHealth(), the module will require a live
 * JSON-RPC provider.  Gate that behind a feature flag / env var so CI
 * remains green without network access.
 * ---------------------------------------------------------------------------
 *
 * @see NetworkService  — stateful network configuration & health manager
 * @see NetworkController — HTTP layer for network operations
 */
import { Module } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NetworkController } from './network.controller';

/**
 * NetworkModule
 *
 * Registers {@link NetworkController} and provides/exports
 * {@link NetworkService} so other feature modules (e.g. BlockchainModule,
 * LiquidityModule) can inject it without importing this module directly
 * when AppModule is the host.
 */
@Module({
  controllers: [NetworkController],
  providers: [NetworkService],
  exports: [NetworkService],
})
export class NetworkModule {}
