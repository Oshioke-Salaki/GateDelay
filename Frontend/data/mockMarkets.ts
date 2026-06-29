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
