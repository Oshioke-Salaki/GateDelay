# Deposit Service - Quick Start

## 🚀 Overview

Automated deposit monitoring and processing service for cryptocurrency deposits.

## ✨ Features

- ✅ Automatic transaction monitoring (every 30 seconds)
- ✅ Multiple confirmation levels (0-12 confirmations)
- ✅ Automatic balance updates
- ✅ Deposit notifications
- ✅ Redis caching
- ✅ Comprehensive statistics
- ✅ 24-hour expiry management

## 📦 Installation

```bash
# Dependencies already installed in package.json
npm install
```

## 🔧 Configuration

Add to `.env`:
```env
BLOCKCHAIN_RPC_URL=https://rpc.mantle.xyz
REDIS_URL=redis://localhost:6379
MONGODB_URI=mongodb://localhost:27017/gatedelay
```

## 🎯 Quick Start

### 1. Import Module

```typescript
// app.module.ts
import { DepositModule } from './deposit/deposit.module';

@Module({
  imports: [
    DepositModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Create a Deposit

```typescript
POST /deposits
{
  "userId": "user123",
  "txHash": "0x1234...",
  "fromAddress": "0xfrom...",
  "toAddress": "0xto...",
  "amount": "1000000000000000000",
  "currency": "ETH",
  "network": "ethereum"
}
```

### 3. Monitor Automatically

The service automatically monitors deposits every 30 seconds!

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/deposits` | Create deposit |
| GET | `/deposits` | List deposits |
| GET | `/deposits/:id` | Get by ID |
| GET | `/deposits/tx/:txHash` | Get by tx hash |
| GET | `/deposits/stats/summary` | Get statistics |
| GET | `/deposits/monitor/status` | Monitor status |
| POST | `/deposits/monitor/trigger` | Manual trigger |

## 🔄 Confirmation Levels

```typescript
INSTANT = 0      // Risky
FAST = 1         // Quick
STANDARD = 3     // Default ✅
SECURE = 6       // Safe
VERY_SECURE = 12 // Very safe
```

## 📈 Status Flow

```
PENDING → CONFIRMING → CONFIRMED
   ↓           ↓
FAILED      EXPIRED
```

## 🧪 Testing

```bash
# Run tests
npm test deposit.service.spec.ts
npm test deposit-monitor.service.spec.ts

# Coverage
npm run test:cov
```

## 📚 Documentation

See `DEPOSIT_SERVICE_DOCUMENTATION.md` for complete documentation.

## 🎉 That's It!

The service handles everything automatically:
- Monitors transactions
- Updates confirmations
- Credits balances
- Sends notifications
- Expires old deposits

Just create deposits and let it run! 🚀
