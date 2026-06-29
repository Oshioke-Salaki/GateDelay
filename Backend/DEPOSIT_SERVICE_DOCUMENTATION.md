# Deposit Service Documentation

## Overview

The Deposit Service is a comprehensive solution for monitoring, confirming, and processing cryptocurrency deposits in the GateDelay prediction market platform.

## Features

### ✅ Core Features
- **Transaction Monitoring**: Automatic monitoring of pending deposits every 30 seconds
- **Blockchain Confirmation**: Real-time tracking of transaction confirmations
- **Balance Updates**: Automatic user balance updates upon confirmation
- **Notifications**: Deposit confirmation notifications
- **Multiple Confirmation Levels**: Support for different security levels (0-12 confirmations)
- **Expiry Management**: Automatic expiration of old pending deposits
- **Caching**: Redis caching for improved performance
- **Statistics**: Comprehensive deposit statistics and analytics

## Architecture

### Components

1. **DepositService** (`deposit.service.ts`)
   - Core business logic
   - CRUD operations
   - Blockchain integration
   - Redis caching

2. **DepositMonitorService** (`deposit-monitor.service.ts`)
   - Background job scheduler
   - Automatic deposit monitoring
   - Balance updates
   - Notification handling

3. **DepositController** (`deposit.controller.ts`)
   - REST API endpoints
   - Request validation
   - Response formatting

4. **Deposit Schema** (`schemas/deposit.schema.ts`)
   - MongoDB data model
   - Indexes for performance
   - Status management

## Confirmation Levels

```typescript
enum ConfirmationLevel {
  INSTANT = 0,      // 0 confirmations (risky)
  FAST = 1,         // 1 confirmation
  STANDARD = 3,     // 3 confirmations (default)
  SECURE = 6,       // 6 confirmations
  VERY_SECURE = 12, // 12 confirmations
}
```

## Deposit Status Flow

```
PENDING → CONFIRMING → CONFIRMED
   ↓           ↓
FAILED      EXPIRED
```

- **PENDING**: Transaction submitted, waiting for first confirmation
- **CONFIRMING**: Has confirmations but not enough yet
- **CONFIRMED**: Required confirmations reached, balance updated
- **FAILED**: Transaction failed on blockchain
- **EXPIRED**: Deposit expired after 24 hours

## API Endpoints

### Create Deposit
```http
POST /deposits
Content-Type: application/json

{
  "userId": "user123",
  "txHash": "0x1234...",
  "fromAddress": "0xfrom...",
  "toAddress": "0xto...",
  "amount": "1000000000000000000",
  "currency": "ETH",
  "network": "ethereum",
  "requiredConfirmations": 3
}
```

### Get All Deposits
```http
GET /deposits?userId=user123&status=confirmed&page=1&limit=20
```

### Get Deposit by ID
```http
GET /deposits/:id
```

### Get Deposit by Transaction Hash
```http
GET /deposits/tx/:txHash
```

### Get Statistics
```http
GET /deposits/stats/summary?userId=user123
```

### Get Monitor Status
```http
GET /deposits/monitor/status
```

### Trigger Manual Monitoring
```http
POST /deposits/monitor/trigger
```

## Usage Examples

### Creating a Deposit

```typescript
import { DepositService } from './deposit/deposit.service';

// Inject the service
constructor(private depositService: DepositService) {}

// Create a deposit
const deposit = await this.depositService.createDeposit({
  userId: 'user123',
  txHash: '0x1234567890abcdef',
  fromAddress: '0xUserAddress',
  toAddress: '0xPlatformAddress',
  amount: '1000000000000000000', // 1 ETH in wei
  currency: 'ETH',
  network: 'ethereum',
  requiredConfirmations: ConfirmationLevel.STANDARD,
});
```

### Querying Deposits

```typescript
// Get user's deposits
const deposits = await this.depositService.getDeposits({
  userId: 'user123',
  status: 'confirmed',
  page: 1,
  limit: 20,
});

// Get deposit by transaction hash
const deposit = await this.depositService.getDepositByTxHash('0x1234...');

// Get statistics
const stats = await this.depositService.getStatistics('user123');
```

## Background Jobs

### Deposit Monitor (Every 30 seconds)
```typescript
@Cron(CronExpression.EVERY_30_SECONDS)
async monitorDeposits(): Promise<void>
```

Monitors all pending deposits and:
1. Fetches transaction details from blockchain
2. Updates confirmation count
3. Confirms deposits when required confirmations reached
4. Updates user balances
5. Sends notifications

### Expiry Job (Every hour)
```typescript
@Cron(CronExpression.EVERY_HOUR)
async expireOldDeposits(): Promise<void>
```

Expires deposits that have been pending for more than 24 hours.

## Database Schema

```typescript
{
  userId: string;              // User identifier
  txHash: string;              // Transaction hash (unique)
  fromAddress: string;         // Sender address
  toAddress: string;           // Recipient address
  amount: string;              // Amount in wei
  currency: string;            // Currency (ETH, USDT, etc.)
  network: string;             // Network (ethereum, polygon, etc.)
  status: DepositStatus;       // Current status
  confirmations: number;       // Current confirmations
  requiredConfirmations: number; // Required confirmations
  blockNumber?: number;        // Block number
  blockHash?: string;          // Block hash
  gasUsed?: string;            // Gas used
  gasPrice?: string;           // Gas price
  balanceUpdated: boolean;     // Balance update flag
  notificationSent: boolean;   // Notification flag
  confirmedAt?: Date;          // Confirmation timestamp
  failedAt?: Date;             // Failure timestamp
  expiresAt?: Date;            // Expiry timestamp
  metadata?: object;           // Additional metadata
  errorMessage?: string;       // Error message if failed
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
}
```

## Indexes

```typescript
// Compound indexes for efficient queries
{ userId: 1, status: 1 }
{ status: 1, confirmations: 1 }
{ createdAt: -1 }
{ expiresAt: 1 } // Sparse index
{ txHash: 1 } // Unique index
```

## Caching Strategy

- **Cache Key**: `deposit:{id}`
- **TTL**: 5 minutes
- **Invalidation**: On any update
- **Storage**: Redis

## Error Handling

### Common Errors

1. **Deposit Already Exists**
   ```
   BadRequestException: Deposit with this transaction hash already exists
   ```

2. **Transaction Not Found**
   ```
   BadRequestException: Transaction not found on blockchain
   ```

3. **Address Mismatch**
   ```
   BadRequestException: From/To address does not match transaction
   ```

4. **Deposit Not Found**
   ```
   NotFoundException: Deposit not found
   ```

## Testing

### Running Tests

```bash
# Unit tests
npm test deposit.service.spec.ts
npm test deposit-monitor.service.spec.ts

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

### Test Coverage

- ✅ Service creation and initialization
- ✅ Deposit creation with validation
- ✅ Deposit retrieval (by ID, txHash, filters)
- ✅ Confirmation updates
- ✅ Status transitions
- ✅ Balance updates
- ✅ Notification handling
- ✅ Expiry management
- ✅ Statistics calculation
- ✅ Error handling
- ✅ Caching behavior
- ✅ Background job execution

## Integration

### With Wallet Service

```typescript
// In deposit-monitor.service.ts
private async updateUserBalance(deposit: any): Promise<void> {
  // Integrate with wallet service
  await this.walletService.creditBalance({
    userId: deposit.userId,
    amount: deposit.amount,
    currency: deposit.currency,
    reference: deposit.txHash,
  });
  
  await this.depositService.markBalanceUpdated(deposit.id);
}
```

### With Notification Service

```typescript
// In deposit-monitor.service.ts
private async sendDepositNotification(deposit: any): Promise<void> {
  // Integrate with notification service
  await this.notificationService.send({
    userId: deposit.userId,
    type: 'DEPOSIT_CONFIRMED',
    title: 'Deposit Confirmed',
    message: `Your deposit of ${deposit.amount} ${deposit.currency} has been confirmed`,
    data: { depositId: deposit.id },
  });
  
  await this.depositService.markNotificationSent(deposit.id);
}
```

## Configuration

### Environment Variables

```env
# Blockchain RPC URL
BLOCKCHAIN_RPC_URL=https://rpc.mantle.xyz

# Redis URL
REDIS_URL=redis://localhost:6379

# MongoDB URL
MONGODB_URI=mongodb://localhost:27017/gatedelay

# Deposit expiry (hours)
DEPOSIT_EXPIRY_HOURS=24

# Monitor interval (seconds)
MONITOR_INTERVAL=30
```

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Processes deposits in batches of 10
2. **Redis Caching**: Reduces database queries
3. **Indexed Queries**: Optimized database indexes
4. **Parallel Processing**: Uses Promise.all for concurrent operations
5. **Efficient Polling**: 30-second intervals to balance responsiveness and load

### Scalability

- **Horizontal Scaling**: Stateless design allows multiple instances
- **Job Distribution**: Use Redis locks for distributed job execution
- **Database Sharding**: Can shard by userId or network
- **Caching Layer**: Redis reduces database load

## Security

### Best Practices

1. **Transaction Verification**: Always verify transactions on blockchain
2. **Address Validation**: Validate sender and recipient addresses
3. **Confirmation Levels**: Use appropriate confirmation levels for security
4. **Expiry Management**: Prevent indefinite pending deposits
5. **Error Logging**: Comprehensive error logging for audit trails

### Recommendations

- Use STANDARD (3 confirmations) for most deposits
- Use SECURE (6 confirmations) for large amounts
- Use VERY_SECURE (12 confirmations) for critical operations
- Never use INSTANT (0 confirmations) in production

## Monitoring

### Metrics to Track

- Pending deposits count
- Average confirmation time
- Failed deposit rate
- Balance update success rate
- Notification delivery rate
- Cache hit rate
- API response times

### Logging

```typescript
// Service logs
this.logger.log(`Created deposit ${deposit.id}`);
this.logger.log(`Updated deposit ${depositId}: ${confirmations} confirmations`);
this.logger.error(`Failed deposit ${depositId}: ${errorMessage}`);

// Monitor logs
this.logger.log(`Monitoring ${pendingDeposits.length} pending deposits`);
this.logger.log(`Expired ${expired} old deposits`);
```

## Troubleshooting

### Common Issues

1. **Deposits Stuck in Pending**
   - Check blockchain RPC connection
   - Verify transaction exists on blockchain
   - Check monitor service is running

2. **Balance Not Updated**
   - Check wallet service integration
   - Verify balanceUpdated flag
   - Check error logs

3. **Notifications Not Sent**
   - Check notification service integration
   - Verify notificationSent flag
   - Check error logs

4. **High Memory Usage**
   - Check Redis connection
   - Verify cache TTL settings
   - Monitor pending deposits count

## Future Enhancements

- [ ] Multi-chain support (Polygon, BSC, etc.)
- [ ] ERC-20 token deposits
- [ ] Deposit limits and rate limiting
- [ ] Advanced analytics dashboard
- [ ] Webhook notifications
- [ ] Deposit fee calculation
- [ ] Automatic refunds for failed deposits
- [ ] Deposit history export

## License

MIT License

## Support

For issues or questions:
- Check the test files for usage examples
- Review the API documentation
- Contact the development team
