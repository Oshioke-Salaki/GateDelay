Arbitrage demo

This demo page shows the `ArbitrageDisplay` component using mock markets.

How to run

1. Start the backend (optional for API-backed markets):

```bash
cd Backend
npm run start:dev
```

2. Start the frontend:

```bash
cd Frontend
npm run dev
```

3. Open the demo page:

http://localhost:3000/arbitrage-demo

Notes on `WagmiArbitrageExecutor`

- The executor performs an ERC20 `approve` followed by a UniswapV2-style `swapExactTokensForTokens`.
- For safety, provide `tokenAddress`, `routerAddress` on market/opportunity objects in production.
- The demo uses mock markets without real addresses, so the execute button will throw unless the opportunity includes blockchain addresses.
- Replace `amountOutMin` with a slippage-protected value before using on mainnet.
 - Mock markets now include placeholder `tokenAddress` and `routerAddress` fields. For safety the executor will:
	 - Prompt you for token/router addresses if not present.
	 - Simulate execution on public networks (non-local chains) and return a fake tx hash.
	 - Perform real `approve` + `swap` only when connected to a local development chain (chainId 31337/1337/1338).

Localnet quickstart (optional)

1. Start a local Hardhat node:

```bash
cd Frontend/localnet
npx hardhat node
```

2. In another shell, deploy the mock tokens and router:

```bash
cd Frontend/localnet
npm install
npm run deploy
```

3. The `deploy` script prints sample market entries you can copy into `Frontend/data/mockMarkets.ts`.

Note: the mock router expects the swap amounts to be equal (for demo simplicity). Don't use this code on mainnet.
