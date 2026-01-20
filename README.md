# Outcome - Flight Prediction Market on Stellar

Outcome is a decentralized flight prediction market built on the Stellar network. It allows users to speculate on flight outcomes (e.g., delays, cancellations) using a transparent and trustless blockchain infrastructure, enhanced by institutional-grade AI analysis.

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

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [Foundry](https://getfoundry.sh/) (Forge, Cast, Anvil)
- [Git](https://git-scm.com/)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/Jemiiah/outcome.git
cd outcome
```

### 2. Smart Contracts

```bash
cd contract
forge build
# Run tests
forge test
```

### 3. Frontend

```bash
cd frontend
npm install
```

**Environment Setup:**
Create a `.env` file in the `frontend` directory:

```env
# Particle Network ConnectKit
NEXT_PUBLIC_PROJECT_ID=your_id
NEXT_PUBLIC_CLIENT_KEY=your_key
NEXT_PUBLIC_APP_ID=your_id
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_id

# AI & Data
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_AVIATION_STACK_KEY=your_aviationstack_key
```

**Run Development Server:**

```bash
npm run dev
```

## 📂 Project Structure

- `contract/`: Solidity contracts, Foundry tests, and deployment scripts.
- `frontend/`: Next.js application, AI routes, and Web3 components.

## 📜 License

[MIT](LICENSE)
