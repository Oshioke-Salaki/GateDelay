# Outcome - Flight Prediction Market on Stellar

Outcome is a decentralized flight prediction market built on the Stellar network. It allows users to speculate on flight outcomes (e.g., delays, cancellations) using a transparent and trustless blockchain infrastructure, enhanced by institutional-grade AI analysis..

## ðŸŒŸ Features

- **Prediction Markets**: Participate in decentralized markets for flight arrival status.
- **AI Risk Assessment**: Integrated Llama 3.1 analysis via **Groq** for real-time trading signals and flight risk reports.
- **Real-time Aviation Data**: Automated flight tracking and market initialization powered by the **AviationStack API**.
- **LMSR pricing**: Logarithmic Market Scoring Rule via `MarketMaker` / `Trading` / `LMSR` (`Contracts/src/`). A separate `OrderBook` CLOB also exists; [ADR 0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md) is undecided and owned by [Phase 2](PHASE_2.md).
- **Hybrid AMM**: Sophisticated Logarithmic Market Scoring Rule (LMSR) for liquidity pricing, paired with a fair cost-based payout mechanism.
- **Cross-Chain Relay**: Chainlink CCIP-powered relay for cross-chain market operations — see [Market Relay Delivery Summary](MARKET_RELAY_DELIVERY_SUMMARY.md).
- **Stellar Network**: High-performance, low-fee prediction market trading powered by the Stellar blockchain.
- **Connect with Ease**: Seamless wallet integration via **Particle Network**, supporting both social and traditional EOA logins.

## ðŸ›  Tech Stack

- **Smart Contracts**:
  - Solidity 0.8.20
  - Foundry (Development & Testing)
  - PRBMath (Numerical Stability for AMM)
- **Frontend**:
  - Next.js 16 (Turbopack)
  - TypeScript & TailwindCSS
  - **Groq SDK**: AI analysis engine (Llama 3.1 8B/70B)
  - **Particle Network**: Universal wallet connection
  - **Recharts & Framer Motion**: Dynamic market visualization and premium UI animations
  - Wagmi & Viem: Type-safe Ethereum interactions

## ðŸ“‹ Prerequisites

- [Node.js](https://nodejs.org/) (v20+ required)
- [Foundry](https://getfoundry.sh/) (Forge, Cast, Anvil)
- [Git](https://git-scm.com/)

## ðŸš€ Getting Started

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for install, environment setup, and how to run the Backend, Frontend, and Foundry tests.

### Quick reference

### 1. Clone the Repository

```bash
git clone https://github.com/Oshioke-Salaki/GateDelay.git
cd GateDelay
```

### 2. Smart Contracts

```bash
cd Contracts
forge build
forge test
```

### 3. Backend

```bash
cd Backend
npm install
cp .env.example .env
npm run start:dev
```

With [`Backend/.env.example`](Backend/.env.example) copied as `.env`, NestJS listens on **port 4000** (`PORT=4000`). If `PORT` is unset, `Backend/src/main.ts` falls back to **3000**. Health: `GET http://localhost:4000/api` (global prefix `api`). Related example values: `FRONTEND_URL=http://localhost:3000`, `HEARTBEAT_PORT=4001`, `RPC_URL=http://127.0.0.1:8545`, `MONGODB_URI=mongodb://127.0.0.1:27017/gatedelay`.

### 4. Frontend

```bash
cd Frontend
npm install
# create .env.local — see CONTRIBUTING.md
npm run dev
```

Next.js defaults to **http://localhost:3000**. Point `NEXT_PUBLIC_BACKEND_URL` at the Backend origin (`http://localhost:4000` when using `.env.example`).

## Documentation map

Keep this README short. Details live in:

| Doc | What it covers | Owner |
|-----|----------------|-------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Install, env templates, how to run each surface | Foundations |
| [PHASES.md](PHASES.md) | Phase roadmap and issue index | Roadmap |
| [PHASE_1.md](PHASE_1.md) | Stabilize foundations (`phase-1`) | Phase 1 |
| [PHASE_2.md](PHASE_2.md) | Core market wiring (`phase-2`) | Phase 2 |
| [ADR 0001](docs/adr/0001-lmsr-vs-clob-ambiguity.md) | LMSR vs CLOB — decision deferred to Phase 2 | Phase 2 |

Do not copy the Phase 2 issue list here; start from [PHASE_2.md](PHASE_2.md).

## Project Structure

- `Contracts/`: Solidity contracts, Foundry tests, and deployment scripts.
- `Backend/`: NestJS API (and legacy Express `server.js`).
- `Frontend/`: Next.js application, AI routes, and Web3 components.

## License
## Further reading

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Full contributor setup guide |
| [PHASES.md](PHASES.md) | Phase roadmap and issue index |
| [CHECKLIST.md](CHECKLIST.md) | Local wallet + trade flow runbook |
| [MARKET_RELAY_DELIVERY_SUMMARY.md](MARKET_RELAY_DELIVERY_SUMMARY.md) | Cross-chain relay system (Chainlink CCIP) |
| [MINTING_PAUSABLE_IMPLEMENTATION.md](MINTING_PAUSABLE_IMPLEMENTATION.md) | Pausable minting token with role-based control |

## ðŸ“œ License

MIT
