# Market Relay Integration Guide for GateDelay

## Overview

This guide provides step-by-step instructions for integrating the MarketRelay contract into GateDelay's cross-chain market operations infrastructure.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GateDelay Market                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Chain A    │  │   Chain B    │  │   Chain C    │           │
│  │ (Arbitrum)   │  │   (Base)     │  │  (Avalanche) │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
        │                    │                    │
        │ CCIP Messages      │ CCIP Messages      │ CCIP Messages
        │                    │                    │
┌───────▼──────────┬─────────▼──────────┬────────▼─────────────────┐
│ MarketRelay      │ MarketRelay        │ MarketRelay              │
│ (Arbitrum)       │ (Base)             │ (Avalanche)              │
│                  │                    │                          │
│ • Status Track   │ • Status Track     │ • Status Track           │
│ • Timeout Handle │ • Timeout Handle   │ • Timeout Handle         │
│ • Retry Logic    │ • Retry Logic      │ • Retry Logic            │
└──────────────────┴────────────────────┴──────────────────────────┘
        △                    △                    △
        │                    │                    │
        └────────────────────┼────────────────────┘
                    Relayer Service
              (Off-chain Coordinator)
```

## Phase 1: Deployment & Configuration

### Step 1.1: Deploy MarketRelay Contracts

Deploy to all supported chains:

```bash
# Define chain parameters
declare -a CHAINS=(
    "arbitrum:42161:0xAA1DC17CFF15F99PI:0x1234..."  # Arbitrum
    "base:8453:0xBB1DC17CFF15F99PI:0x5678..."       # Base
    "avalanche:43114:0xCC1DC17CFF15F99PI:0x9abc..."  # Avalanche
)

# Deploy to each chain
for chain_info in "${CHAINS[@]}"; do
    IFS=':' read -r name chainid router owner <<< "$chain_info"
    
    forge create Contracts/contracts/MarketRelay.sol:MarketRelay \
        --rpc-url $RPC_URL \
        --private-key $DEPLOYER_KEY \
        --constructor-args \
            $router \              # CCIP Router address
            $RELAYER_SERVICE \     # Relayer address (see Phase 2)
            $FEE_RECIPIENT \       # Treasury address
            $owner                 # Contract owner (multisig)
done
```

### Step 1.2: Configure Chain Relationships

```solidity
// After deployment, configure all supported chains from any chain
// Example: Configure Arbitrum → Base relay path

relay.configureChain(
    BASE_CHAIN_SELECTOR,           // uint64: 15971525489660198786
    1 hours,                        // defaultTimeout
    3,                              // maxRetries
    5 minutes,                      // retryDelay
    0.01 ether,                     // baseFee
    100                             // feeBps (1%)
);

relay.configureChain(
    AVALANCHE_CHAIN_SELECTOR,       // uint64: 6433500567565415381
    2 hours,                        // longer timeout for Avalanche
    2,                              // fewer retries
    10 minutes,                     // longer delay
    0.02 ether,                     // higher base fee
    50                              // 0.5% fee
);

relay.configureChain(
    ARBITRUM_CHAIN_SELECTOR,        // uint64: 4949039107694359331
    30 minutes,                     // fast chain
    5,                              // more retries available
    2 minutes,                      // short delay
    0.005 ether,                    // low base fee
    25                              // 0.25% fee
);
```

### Step 1.3: Set Admin Addresses

```solidity
// Owner operations (multisig)

// 1. Set relayer service address
relay.setRelayer(RELAYER_SERVICE_ADDRESS);

// 2. Set fee recipient (treasury)
relay.setFeeRecipient(TREASURY_ADDRESS);

// 3. Verify CCIP router is correct
relay.setRelayRouter(CHAINLINK_CCIP_ROUTER);

// 4. Transfer ownership to DAO/Governance
relay.transferOwnership(DAO_GOVERNANCE_ADDRESS);
```

## Phase 2: Relayer Service Implementation

### Step 2.1: Relayer Service Architecture

```python
# Example relayer service pseudocode

class MarketRelayService:
    def __init__(self, chains, relay_contracts):
        self.chains = chains
        self.relay_contracts = relay_contracts
        self.pending_operations = {}
        self.ccip_listener = CCIPEventListener()
    
    def start(self):
        # Start monitoring for new relays
        self.listen_for_relay_events()
        # Start monitoring for CCIP callbacks
        self.listen_for_ccip_callbacks()
        # Start timeout enforcement
        self.enforce_timeouts()
    
    def listen_for_relay_events(self):
        """Monitor RelayInitiated events across all chains"""
        while True:
            for chain_id, relay_contract in self.relay_contracts.items():
                events = relay_contract.get_recent_events('RelayInitiated')
                for event in events:
                    operation_id = event.operationId
                    dest_chain = event.destChain
                    self.pending_operations[operation_id] = {
                        'status': 'initiated',
                        'dest_chain': dest_chain,
                        'timestamp': time.now()
                    }
                    # Schedule execution
                    self.schedule_execution(operation_id, dest_chain)
    
    def schedule_execution(self, operation_id, dest_chain):
        """Schedule relay execution on destination chain"""
        relay_contract = self.relay_contracts[dest_chain]
        operation_data = self.get_operation_data(operation_id)
        
        # Execute on destination chain
        try:
            relay_contract.updateRelayExecuting(operation_id)
            # Execute the actual operation
            result = self.execute_operation(operation_data)
            # Mark as completed
            relay_contract.completeRelay(operation_id, result)
            self.pending_operations[operation_id]['status'] = 'completed'
        except Exception as e:
            relay_contract.failRelay(operation_id, str(e))
            self.pending_operations[operation_id]['status'] = 'failed'
    
    def enforce_timeouts(self):
        """Periodic timeout enforcement"""
        while True:
            for chain_id, relay_contract in self.relay_contracts.items():
                expired = relay_contract.getExpiredRelays()
                for operation_id in expired:
                    try:
                        relay_contract.checkTimeout(operation_id)
                        self.log_timeout_enforcement(operation_id)
                    except Exception as e:
                        self.log_error(f"Timeout enforcement failed: {e}")
            time.sleep(300)  # Check every 5 minutes
```

### Step 2.2: Relayer Service Deployment

```bash
# Deploy relayer service as a cloud function/container

# 1. Create service environment
cat > .env.relayer << EOF
# CCIP Configuration
CCIP_ROUTER_ARBITRUM=0xAA1DC17CFF15F99PI
CCIP_ROUTER_BASE=0xBB1DC17CFF15F99PI
CCIP_ROUTER_AVALANCHE=0xCC1DC17CFF15F99PI

# MarketRelay Addresses
MARKET_RELAY_ARBITRUM=0x1111111111111111111111111111111111111111
MARKET_RELAY_BASE=0x2222222222222222222222222222222222222222
MARKET_RELAY_AVALANCHE=0x3333333333333333333333333333333333333333

# RPC Endpoints
RPC_ARBITRUM=https://arbitrum-mainnet.infura.io/v3/$INFURA_KEY
RPC_BASE=https://base-mainnet.infura.io/v3/$INFURA_KEY
RPC_AVALANCHE=https://avalanche-mainnet.infura.io/v3/$INFURA_KEY

# Relayer Signer
RELAYER_PRIVATE_KEY=0x...
EOF

# 2. Deploy service
docker build -t gatedelay-relay-service .
docker run -d --env-file .env.relayer gatedelay-relay-service

# 3. Monitor service
docker logs -f $(docker ps -q -f ancestor=gatedelay-relay-service)
```

## Phase 3: Integration with Market Operations

### Step 3.1: Cross-Chain Trade Execution

```solidity
// Example: Execute trade across chains

contract GateDeLay_TradeExecutor {
    MarketRelay public relay;
    
    function executeCrossChainTrade(
        uint64 destChain,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external payable returns (bytes32 operationId) {
        // Encode the operation
        bytes memory tradeData = abi.encode(
            TRADE_EXECUTOR_SELECTOR,  // Function to call on destination
            address(this),             // Callback address
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut
        );
        
        // Calculate fee
        uint256 fee = relay.calculateRelayFee(destChain, amountIn);
        require(msg.value >= fee, "Insufficient fee");
        
        // Initiate relay
        operationId = relay.initiateRelay{value: fee}(
            destChain,
            tradeData,
            0  // No value transfer needed
        );
        
        // Track trade
        emit CrossChainTradeInitiated(operationId, destChain, amountIn);
    }
    
    // Called by relayer when trade completes
    function onTradeCompleted(
        bytes32 operationId,
        uint256 amountOut,
        uint256 executionPrice
    ) external {
        // Process completed trade
        emit CrossChainTradeCompleted(operationId, amountOut, executionPrice);
    }
}
```

### Step 3.2: Cross-Chain Liquidation

```solidity
// Example: Coordinate liquidations across chains

contract GateDeLay_LiquidationCoordinator {
    MarketRelay public relay;
    
    function triggerCrossChainLiquidation(
        uint64 liquidationChain,
        address borrower,
        address collateral,
        uint256 collateralAmount
    ) external returns (bytes32 operationId) {
        // Build liquidation instruction
        bytes memory liquidationData = abi.encode(
            LIQUIDATION_SELECTOR,
            borrower,
            collateral,
            collateralAmount,
            msg.sender  // Liquidator address
        );
        
        // Calculate fee
        uint256 fee = relay.calculateRelayFee(liquidationChain, collateralAmount);
        
        // Send relay
        operationId = relay.initiateRelay{value: fee}(
            liquidationChain,
            liquidationData,
            0
        );
        
        // Record pending liquidation
        emit LiquidationInitiated(operationId, borrower, collateralAmount);
    }
    
    // Monitor liquidation status
    function getLiquidationStatus(bytes32 operationId) 
        external view returns (string memory status, uint256 proceeds) 
    {
        MarketRelay.RelayStatus relayStatus = relay.getRelayStatus(operationId);
        
        if (relayStatus == MarketRelay.RelayStatus.Completed) {
            MarketRelay.RelayOperation memory op = relay.getRelayOperation(operationId);
            proceeds = abi.decode(op.result, (uint256));
            return ("completed", proceeds);
        }
        
        return (statusToString(relayStatus), 0);
    }
}
```

### Step 3.3: Cross-Chain Arbitrage Detection & Execution

```solidity
// Example: Detect and execute arbitrage across chains

contract GateDeLay_ArbitrageEngine {
    MarketRelay public relay;
    
    struct ArbitrageOpportunity {
        uint64 buyChain;
        uint64 sellChain;
        address token;
        uint256 amount;
        uint256 expectedProfit;
    }
    
    function executeArbitrage(
        ArbitrageOpportunity memory arb
    ) external returns (bytes32 buyOpId, bytes32 sellOpId) {
        // Step 1: Buy on cheaper chain
        bytes memory buyData = abi.encode(
            BUY_SELECTOR,
            arb.token,
            arb.amount,
            address(this)  // Recipient on destination
        );
        
        uint256 buyFee = relay.calculateRelayFee(arb.buyChain, 0);
        buyOpId = relay.initiateRelay{value: buyFee}(
            arb.buyChain,
            buyData,
            0
        );
        
        // Step 2: Sell on expensive chain (after Step 1 completes)
        bytes memory sellData = abi.encode(
            SELL_SELECTOR,
            arb.token,
            arb.amount,
            address(this)  // Recipient
        );
        
        uint256 sellFee = relay.calculateRelayFee(arb.sellChain, 0);
        sellOpId = relay.initiateRelay{value: sellFee}(
            arb.sellChain,
            sellData,
            0
        );
        
        emit ArbitrageInitiated(buyOpId, sellOpId, arb.expectedProfit);
    }
    
    // Verify arbitrage success
    function checkArbitrageResult(bytes32 buyOpId, bytes32 sellOpId)
        external view returns (uint256 totalProfit)
    {
        require(
            relay.getRelayStatus(buyOpId) == MarketRelay.RelayStatus.Completed,
            "Buy not completed"
        );
        require(
            relay.getRelayStatus(sellOpId) == MarketRelay.RelayStatus.Completed,
            "Sell not completed"
        );
        
        MarketRelay.RelayOperation memory buyOp = relay.getRelayOperation(buyOpId);
        MarketRelay.RelayOperation memory sellOp = relay.getRelayOperation(sellOpId);
        
        uint256 buyAmount = abi.decode(buyOp.result, (uint256));
        uint256 sellAmount = abi.decode(sellOp.result, (uint256));
        
        return sellAmount > buyAmount ? sellAmount - buyAmount : 0;
    }
}
```

## Phase 4: Monitoring & Maintenance

### Step 4.1: Event Monitoring

```solidity
// Track key metrics

contract RelayMonitor {
    MarketRelay public relay;
    
    struct DailyStats {
        uint256 operationsInitiated;
        uint256 operationsCompleted;
        uint256 operationsFailed;
        uint256 operationsTimeout;
        uint256 totalFeeCollected;
    }
    
    mapping(uint256 => DailyStats) dailyStats;  // timestamp => stats
    
    // Called by keeper bot daily
    function recordDailyStats() external {
        uint256 dayKey = block.timestamp / 1 days;
        
        // Calculate stats for the day
        bytes32[] memory history = relay.getAllRelayHistory();
        // Process history...
    }
    
    // Query statistics
    function getOperationSuccessRate(uint256 daysLookback)
        external view returns (uint256 successRate)
    {
        uint256 totalOps = 0;
        uint256 successfulOps = 0;
        
        for (uint256 i = 0; i < daysLookback; i++) {
            uint256 dayKey = (block.timestamp / 1 days) - i;
            totalOps += dailyStats[dayKey].operationsInitiated;
            successfulOps += dailyStats[dayKey].operationsCompleted;
        }
        
        return totalOps > 0 ? (successfulOps * 100) / totalOps : 0;
    }
}
```

### Step 4.2: Fee Management

```solidity
// Manage accumulated fees

contract RelayFeeManager {
    MarketRelay public relay;
    address public treasury;
    
    // Monthly fee distribution
    function distributeMontlyFees() external {
        uint256 totalFees = relay.totalFeesCollected();
        uint256 alreadyDistributed = lastDistributedFees;
        uint256 newFees = totalFees - alreadyDistributed;
        
        // Allocate fees:
        // 50% → Treasury
        // 30% → Relayer rewards
        // 20% → Insurance fund
        
        uint256 treasuryShare = (newFees * 50) / 100;
        uint256 relayerShare = (newFees * 30) / 100;
        uint256 insuranceShare = (newFees * 20) / 100;
        
        relay.withdrawFees(treasury, treasuryShare);
        relay.withdrawFees(relayerAddress, relayerShare);
        relay.withdrawFees(insuranceFund, insuranceShare);
        
        lastDistributedFees = totalFees;
        emit FeesDistributed(treasuryShare, relayerShare, insuranceShare);
    }
}
```

### Step 4.3: Alerting & Escalation

```solidity
// Set up alerts for anomalies

contract RelayAlertManager {
    MarketRelay public relay;
    
    uint256 public maxTimeoutRate = 5;  // 5% max timeouts
    uint256 public maxFailureRate = 10; // 10% max failures
    
    function checkHealthMetrics() external {
        bytes32[] memory recentOps = relay.getAllRelayHistory();
        
        uint256 totalRecent = 0;
        uint256 timeouts = 0;
        uint256 failures = 0;
        
        // Analyze last 100 operations
        uint256 start = recentOps.length > 100 ? recentOps.length - 100 : 0;
        for (uint256 i = start; i < recentOps.length; i++) {
            MarketRelay.RelayHistory memory hist = relay.getRelayHistory(recentOps[i]);
            
            if (hist.status == MarketRelay.RelayStatus.Timeout) {
                timeouts++;
            } else if (hist.status == MarketRelay.RelayStatus.Failed) {
                failures++;
            }
            totalRecent++;
        }
        
        uint256 timeoutRate = (timeouts * 100) / totalRecent;
        uint256 failureRate = (failures * 100) / totalRecent;
        
        if (timeoutRate > maxTimeoutRate) {
            emit HighTimeoutRateAlert(timeoutRate);
        }
        if (failureRate > maxFailureRate) {
            emit HighFailureRateAlert(failureRate);
        }
    }
}
```

## Phase 5: Upgrade & Expansion

### Step 5.1: Add New Chains

```bash
# When adding a new chain to GateDelay:

1. Deploy MarketRelay to new chain
2. Configure relay relationships:

   relay.configureChain(
       NEW_CHAIN_SELECTOR,
       timeout,
       maxRetries,
       retryDelay,
       baseFee,
       feeBps
   );

3. Update relayer service config
4. Run integration tests
5. Monitor for 24-48 hours
6. Gradually increase traffic
```

### Step 5.2: Parameter Optimization

```solidity
// Based on historical data, optimize parameters

function optimizeChainParameters(uint64 chainSelector) external {
    // Analyze history for the chain
    bytes32[] memory history = relay.getAllRelayHistory();
    
    uint256 totalOps = 0;
    uint256 timeouts = 0;
    uint256 failures = 0;
    
    for (uint256 i = 0; i < history.length; i++) {
        MarketRelay.RelayHistory memory hist = relay.getRelayHistory(history[i]);
        // Count ops for this chain...
    }
    
    // If timeout rate > 10%, increase timeout
    // If failure rate > 15%, increase maxRetries
    // If cost is high, increase fee or reduce traffic
}
```

## Troubleshooting Guide

### Issue 1: Operations Timing Out

**Symptoms**: Multiple operations mark as Timeout status

**Root Causes**:
- Network congestion
- Relayer service offline
- CCIP router issues

**Solutions**:
```solidity
// Increase timeout for affected chain
relay.updateChainConfig(
    CHAIN_SELECTOR,
    3 hours,    // Increased from 1 hour
    5           // Increased retries
);

// Or manually retry timed-out operations
bytes32 opId = /* timed out operation */;
relay.cancelRelay(opId);
relay.initiateRelay(...);  // Reinitiate
```

### Issue 2: Relayer Service Failures

**Symptoms**: Operations stuck in Executing state

**Root Causes**:
- Service crash
- Database issues
- Message queue overflow

**Solutions**:
```bash
# Restart service
systemctl restart gatedelay-relay-service

# Check logs
journalctl -u gatedelay-relay-service -n 100

# Reset stuck operations
# (manually call completeRelay or failRelay after investigation)
```

### Issue 3: High Fee Accumulation

**Symptoms**: Large balance in contract

**Solutions**:
```solidity
// Distribute fees regularly
relay.withdrawFees(treasuryAddress, accumulatedAmount);

// Or reduce fees if they're too high
relay.updateChainConfig(
    chainSelector,
    timeout,
    maxRetries,
    retryDelay,
    0.005 ether,  // Lower base fee
    25            // Lower fee percentage
);
```

## Production Checklist

- [ ] All MarketRelay contracts deployed on all chains
- [ ] All chain relationships configured
- [ ] Relayer service running and monitored
- [ ] Fee structure established and documented
- [ ] Alert thresholds configured
- [ ] Backup relayer service ready
- [ ] Emergency pause mechanism implemented
- [ ] Audit completed
- [ ] Insurance/slashing mechanism designed
- [ ] Governance process established
- [ ] Documentation complete
- [ ] Team trained on operations
- [ ] Gradual rollout plan (10% → 50% → 100%)
- [ ] Historical data collection started
- [ ] Backup and recovery procedures documented

## Support & Contact

For issues or questions:
- Create issue in repository
- Contact security team: security@gatedelay.io
- Emergency: escalate@gatedelay.io
