# GateDelay Backend - Implementation Guide

This backend implements 4 core features for the GateDelay flight prediction market platform.

## Features Implemented

### ✅ Issue #43: User Authentication API
- **JWT token-based authentication** with access and refresh tokens
- **User registration and login** with bcrypt password hashing
- **Social login support** (Google, Twitter) - framework ready
- **Password reset** via email with time-limited tokens
- **Session management** with refresh token rotation
- **Rate limiting** on login endpoint (5 attempts per minute)
- **Security**: Protected against common attacks (SQL injection, XSS via validation)

**Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/social` - Social login (Google/Twitter)
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout (requires JWT)

### ✅ Issue #44: Market Data Fetching Service
- **AviationStack API integration** for real-time flight data
- **Redis caching** with 5-minute TTL to respect rate limits
- **Scheduled data refresh** every 5 minutes via cron jobs
- **Error handling** with retry logic and logging
- **Filtered endpoints** for flights, airlines, and specific flight lookups

**Endpoints:**
- `GET /api/market-data/flights` - Get flights (with filters: status, airline, flight number)
- `GET /api/market-data/flights/:iata` - Get specific flight by IATA code
- `GET /api/market-data/airlines` - Get airlines (with search)

### ✅ Issue #45: Real-time Price WebSocket Handler
- **Socket.io WebSocket server** on `/prices` namespace
- **JWT authentication** for WebSocket connections
- **Subscription system** for specific markets
- **Connection limits** (max 5 per user)
- **Broadcast methods** for price updates and market data
- **Automatic cleanup** on disconnect

**WebSocket Events:**
- `subscribe` - Subscribe to market IDs
- `unsubscribe` - Unsubscribe from market IDs
- `priceUpdate` - Receive price updates (server → client)
- `marketData` - Receive general market data (server → client)

### ✅ Issue #46: Transaction Broadcast Endpoint
- **Accepts signed transactions** from frontend
- **Validates transaction data** using ethers.js
- **Broadcasts to Mantle Network** (or configured blockchain)
- **Tracks transaction status** with confirmation counts
- **Provides transaction hash** and status endpoints
- **Automatic confirmation tracking** (polls every 5 seconds)

**Endpoints:**
- `POST /api/blockchain/broadcast` - Broadcast signed transaction
- `GET /api/blockchain/tx/:hash` - Get transaction status

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `JWT_SECRET` - Secret for JWT access tokens
- `JWT_REFRESH_SECRET` - Secret for refresh tokens
- `REDIS_HOST` / `REDIS_PORT` - Redis connection
- `SMTP_*` - Email configuration for password reset
- `AVIATION_STACK_API_KEY` - AviationStack API key
- `BLOCKCHAIN_RPC_URL` - Mantle Network RPC URL

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Redis

```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine

# Or install locally
# macOS: brew install redis && redis-server
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
```

### 4. Run the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000` (or configured PORT).

## API Documentation

### Authentication Flow

1. **Register**: `POST /api/auth/register`
```json
{
  "email": "user@example.com",
  "password": "securepass123",
  "name": "John Doe"
}
```

2. **Login**: `POST /api/auth/login`
```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

Response:
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

3. **Use JWT**: Add header to protected endpoints:
```
Authorization: Bearer <accessToken>
```

### WebSocket Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/prices', {
  auth: { token: '<accessToken>' }
});

// Subscribe to markets
socket.emit('subscribe', { marketIds: ['market1', 'market2'] });

// Listen for price updates
socket.on('priceUpdate', (data) => {
  console.log('Price update:', data);
  // { marketId, price, volume, timestamp }
});
```

### Transaction Broadcasting

```javascript
// Frontend signs transaction with user's wallet
const signedTx = await wallet.signTransaction(tx);

// Send to backend
const response = await fetch('/api/blockchain/broadcast', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ signedTransaction: signedTx })
});

const { txHash } = await response.json();

// Poll for status
const status = await fetch(`/api/blockchain/tx/${txHash}`);
```

## Architecture

```
src/
├── auth/                    # Authentication module
│   ├── dto/                 # Data transfer objects
│   ├── entities/            # User entity
│   ├── guards/              # JWT auth guard
│   ├── strategies/          # Passport JWT strategy
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts
├── market-data/             # Market data module
│   ├── market-data.controller.ts
│   ├── market-data.service.ts
│   └── market-data.module.ts
├── websocket/               # WebSocket module
│   ├── price.gateway.ts
│   └── websocket.module.ts
├── blockchain/              # Blockchain module
│   ├── dto/
│   ├── blockchain.controller.ts
│   ├── blockchain.service.ts
│   └── blockchain.module.ts
├── app.module.ts            # Root module
└── main.ts                  # Application entry point
```

## Security Features

- ✅ **Password hashing** with bcrypt (10 rounds)
- ✅ **JWT tokens** with short expiry (15 min access, 7 day refresh)
- ✅ **Rate limiting** on sensitive endpoints
- ✅ **Input validation** with class-validator
- ✅ **CORS** configuration
- ✅ **WebSocket authentication** via JWT
- ✅ **Connection limits** per user
- ✅ **Transaction validation** before broadcast

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Production Considerations

### Current Implementation (Development)
- In-memory user storage (Map)
- Basic error handling
- Stub social login verification

### Production Requirements
- **Database**: Replace in-memory storage with PostgreSQL/MongoDB
- **Social OAuth**: Implement Google/Twitter OAuth verification
- **Email Service**: Configure production SMTP or use SendGrid/AWS SES
- **Redis**: Use Redis Cluster for high availability
- **Monitoring**: Add APM (New Relic, DataDog)
- **Logging**: Structured logging with Winston/Pino
- **Rate Limiting**: Use Redis-backed rate limiter
- **Load Balancing**: Deploy behind Nginx/ALB
- **Environment**: Use secrets manager (AWS Secrets Manager, Vault)

## Troubleshooting

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### JWT Verification Failed
- Ensure `JWT_SECRET` matches between requests
- Check token hasn't expired
- Verify `Authorization: Bearer <token>` header format

### WebSocket Connection Refused
- Verify CORS settings in `main.ts`
- Check JWT token is valid
- Ensure Socket.io client version matches server

### Transaction Broadcast Failed
- Verify `BLOCKCHAIN_RPC_URL` is correct
- Check signed transaction is valid
- Ensure network has sufficient gas

## License

MIT
