# Outcome - Flight Prediction Market on Stellar

Outcome is a decentralized flight prediction market built on the Stellar network. It allows users to speculate on flight outcomes (e.g., delays, cancellations) using a transparent and trustless blockchain infrastructure, enhanced by institutional-grade AI analysis..

## 🌟 Features

- **Prediction Markets**: Participate in decentralized markets for flight arrival status.
- **AI Risk Assessment**: Integrated Llama 3.1 analysis via **Groq** for real-time trading signals and flight risk reports.
- **Real-time Aviation Data**: Automated flight tracking and market initialization powered by the **AviationStack API**.
- **Hybrid AMM**: Sophisticated Logarithmic Market Scoring Rule (LMSR) for liquidity pricing, paired with a fair cost-based payout mechanism.
- **Mantle Network**: High-performance, low-fee trading secured by Ethereum.
- **Connect with Ease**: Seamless wallet integration via **Particle Network**, supporting both social and traditional EOA logins.

## 🛠 Tech Stack

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

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) 20.11.1 (see `.nvmrc`)
- npm 10.2.4
- [Foundry](https://getfoundry.sh/) (Forge, Cast, Anvil)
- [Git](https://git-scm.com/)

## 🚀 Getting Started

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
npm ci
cp .env.example .env
npm run start:dev
```

### 4. Frontend

```bash
cd Frontend
npm ci
# create .env.local — see CONTRIBUTING.md
npm run dev
```

<details>
<summary>Legacy README paths (deprecated)</summary>

</details>

## 📂 Project Structure

- `Contracts/`: Solidity contracts, Foundry tests, and deployment scripts.
- `Backend/`: NestJS API (and legacy Express `server.js`).
- `Frontend/`: Next.js application, AI routes, and Web3 components.

## 📜 License

[MIT](LICENSE)
