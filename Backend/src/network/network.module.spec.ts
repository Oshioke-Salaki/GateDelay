/**
 * @file network.module.spec.ts
 * @description Unit tests for NetworkModule boot dependency (issue #589).
 *
 * Verifies that:
 *  1. NetworkModule can be compiled and bootstrapped with no external
 *     infrastructure (no MongoDB, no Redis, no live RPC URL).
 *  2. NetworkService is available from the module's dependency-injection
 *     context (i.e., the `exports` declaration is correct).
 *  3. NetworkController is registered and resolvable.
 *  4. NetworkService initialises the three built-in networks (mainnet,
 *     testnet, polygon) using safe env-var defaults, so the app boots green
 *     even without a .env file.
 *  5. The current network defaults to 'mainnet' on a fresh boot.
 *
 * Note: uuid v14 ships as pure ESM; we mock it here so Jest's CommonJS
 * transform (ts-jest) can load NetworkService without an ESM parse error.
 */

// Mock uuid before any module import so ts-jest resolves it as CJS.
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-abcd',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NetworkModule } from './network.module';
import { NetworkService } from './network.service';
import { NetworkController } from './network.controller';

describe('NetworkModule (boot dependency — issue #589)', () => {
  let module: TestingModule;
  let networkService: NetworkService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [NetworkModule],
    }).compile();

    networkService = module.get<NetworkService>(NetworkService);
  });

  afterAll(async () => {
    await module.close();
  });

  // ── 1. Module bootstraps without external infrastructure ─────────────────
  it('should compile and bootstrap without external dependencies', () => {
    expect(module).toBeDefined();
  });

  // ── 2. NetworkService is exported and injectable ──────────────────────────
  it('should expose NetworkService from its DI context', () => {
    expect(networkService).toBeDefined();
    expect(networkService).toBeInstanceOf(NetworkService);
  });

  // ── 3. NetworkController is registered ───────────────────────────────────
  it('should register NetworkController', () => {
    const controller = module.get<NetworkController>(NetworkController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(NetworkController);
  });

  // ── 4. Three built-in networks initialised with safe defaults ────────────
  it('should initialise mainnet, testnet, and polygon on boot', () => {
    const networks = networkService.getAllNetworks();
    const names = networks.map((n) => n.name);

    expect(names).toContain('mainnet');
    expect(names).toContain('testnet');
    expect(names).toContain('polygon');
    expect(networks).toHaveLength(3);
  });

  it('should provide a valid RPC URL for each built-in network', () => {
    const networks = networkService.getAllNetworks();
    for (const net of networks) {
      expect(typeof net.rpcUrl).toBe('string');
      expect(net.rpcUrl.length).toBeGreaterThan(0);
    }
  });

  // ── 5. Default network is mainnet ─────────────────────────────────────────
  it('should default to mainnet as the current network', () => {
    const current = networkService.getCurrentNetwork();
    expect(current.name).toBe('mainnet');
    expect(current.chainId).toBe(1);
  });

  // ── 6. All four contract address slots present for mainnet ────────────────
  it('should expose all four contract address keys for mainnet', () => {
    const mainnet = networkService.getNetworkConfig('mainnet');
    const keys = Object.keys(mainnet.contractAddresses);
    expect(keys).toEqual(
      expect.arrayContaining(['market', 'trading', 'liquidity', 'collateral']),
    );
  });

  // ── 7. Network switch is handled without infrastructure ───────────────────
  it('should switch networks in-memory without network I/O', () => {
    const event = networkService.switchNetwork('testnet');
    expect(event.fromNetwork).toBe('mainnet');
    expect(event.toNetwork).toBe('testnet');
    expect(event.status).toBe('success');

    // Restore default for subsequent tests
    networkService.switchNetwork('mainnet');
    expect(networkService.getCurrentNetwork().name).toBe('mainnet');
  });

  // ── 8. Unknown network throws cleanly ────────────────────────────────────
  it('should throw BadRequestException for unknown network names', () => {
    expect(() => networkService.getNetworkConfig('unknownnet')).toThrow();
  });
});
