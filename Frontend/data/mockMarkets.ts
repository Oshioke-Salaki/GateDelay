export const mockMarkets = [
  {
    id: 'm1',
    name: 'Binance ETH-USDT',
    asset: 'ETH',
    price: 2000,
    feePercent: 0.1,
    liquidity: 500,
    // placeholder ERC20 token addresses for demo; replace with local mock tokens when testing locally
    tokenAddress: '0x1000000000000000000000000000000000000001',
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  },
  import { ReplayProtectionService } from './replay-protection.service';

describe('nonce generation', () => {
  const svc = new ReplayProtectionService(/* your deps */);

  it('produces 64-char lowercase hex nonces', () => {
    expect(svc.generateNonce()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not repeat across many generations', () => {
    const seen = new Set(Array.from({ length: 10_000 }, () => svc.generateNonce()));
    expect(seen.size).toBe(10_000);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    svc.generateNonce();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it.each([
    '', 'abc', 'G'.repeat(64), 'A'.repeat(64), '0'.repeat(63), '0'.repeat(65),
    null, undefined, 123,
  ])('rejects malformed nonce %p', (bad) => {
    expect(svc.isValidNonceFormat(bad as any)).toBe(false);
  });
});
  {
    id: 'm2',
    name: 'Uniswap ETH-USDT',
    asset: 'ETH',
    price: 2002,
    feePercent: 0.3,
    liquidity: 300,
    tokenAddress: '0x1000000000000000000000000000000000000001',
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  },
  {
    id: 'm3',
    name: 'Kraken BTC-USDT',
    asset: 'BTC',
    price: 30000,
    feePercent: 0.2,
    liquidity: 50,
    tokenAddress: '0x2000000000000000000000000000000000000002',
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  },
  {
    id: 'm4',
    name: 'Binance BTC-USDT',
    asset: 'BTC',
    price: 29950,
    feePercent: 0.1,
    liquidity: 200,
    tokenAddress: '0x2000000000000000000000000000000000000002',
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  },
]

export default mockMarkets
