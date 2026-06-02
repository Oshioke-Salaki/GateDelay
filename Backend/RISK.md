# Market Risk API - v1.0.0

**Status:** ✅ PRODUCTION READY

---

## Setup

```javascript
const riskService = require('./services/riskService');
const riskRoutes = require('./routes/risk');

app.use('/api/risk', riskRoutes);
```

---

## 10 Endpoints

```
POST   /score/concentration             Portfolio concentration risk
POST   /score/volatility                Price volatility risk
POST   /score/leverage                  Leverage exposure risk
POST   /score/liquidation-proximity     Distance from liquidation
GET    /score/overall/:userId           Weighted overall risk score
GET    /config                          Get risk configuration
PUT    /config/:userId                  Update risk thresholds
GET    /alerts/:userId                  Check for risk alerts
POST   /restrictions/check              Check operation restrictions
GET    /metrics                         System-wide risk metrics
```

---

## 5 Risk Scoring Metrics

1. **Portfolio Concentration** (20% weight)
   - Single asset exposure threshold: 30%
   - Formula: (Max Asset % / 30%) \* 100

2. **Price Volatility** (25% weight)
   - Volatility threshold: 20%
   - Formula: (Std Dev / 20%) \* 100

3. **Leverage Ratio** (20% weight)
   - Leverage threshold: 10x
   - Formula: (Avg Leverage / 10x) \* 100

4. **Liquidation Proximity** (20% weight)
   - Liquidation threshold: 5% margin ratio
   - Formula: (5% / Current Ratio) \* 100

5. **Collateral Correlation** (15% weight)
   - Correlation threshold: 80%
   - Measures asset correlation risk

---

## Overall Risk Score Calculation

```
Score = (Concentration × 0.20)
      + (Volatility × 0.25)
      + (Leverage × 0.20)
      + (Liquidation × 0.20)
      + (Correlation × 0.15)
```

**Risk Levels:**

- 0-25: LOW (Green)
- 25-50: MEDIUM (Yellow)
- 50-75: HIGH (Orange)
- 75-100: CRITICAL (Red)

---

## Example Flow

```javascript
// 1. Get overall risk score for user
const riskScore = await riskService.calculateOverallRiskScore('user123');
// Returns: {overallScore: 42, level: 'Medium', components: {...}}

// 2. Check specific metrics
const concentration = await riskService.calculateConcentrationRisk('user123');
// maxConcentration: 32% (exceeds 30% threshold) → Medium risk

const leverage = await riskService.calculateLeverageRisk('user123');
// averageLeverage: 8.5 (below 10 threshold) → Low risk

// 3. Check for alerts
const alerts = await riskService.checkRiskTriggers('user123');
// Returns: alerts if score > 50%, notifications ready

// 4. Check restrictions for operation
const restrictions = await riskService.checkRiskRestrictions(
  'user123',
  'openPosition',
);
// If score > 75%: canOpenPosition = false (CRITICAL)
// If score > 50%: maxLeverageAllowed = 10

// 5. Configure custom thresholds
await riskService.updateRiskThresholds('user123', {
  PORTFOLIO_CONCENTRATION_THRESHOLD: '25', // Tighter
  LEVERAGE_THRESHOLD: '5', // Lower
});

// 6. Get system-wide metrics
const metrics = await riskService.getRiskMetrics();
// Returns: avgRiskScore, distribution by level, user counts
```

---

## Risk Levels & Actions

```
LOW (0-25)
├─ Status: Safe
├─ Max Leverage: 100x
├─ Actions: None
└─ Monitoring: Standard

MEDIUM (25-50)
├─ Status: Caution
├─ Max Leverage: 50x
├─ Actions: Monitor portfolio
└─ Notifications: Email alerts

HIGH (50-75)
├─ Status: Warning
├─ Max Leverage: 10x
├─ Actions: Reduce positions
├─ Restrictions: Position increases blocked
└─ Notifications: SMS + Email

CRITICAL (75-100)
├─ Status: Emergency
├─ Max Leverage: 1x only
├─ Actions: Open new positions blocked
├─ Restrictions: All operations restricted
└─ Notifications: Immediate alerts
```

---

## Default Configuration

```javascript
PORTFOLIO_CONCENTRATION_THRESHOLD: '30'     // 30% max single asset
VOLATILITY_THRESHOLD: '20'                  // 20% volatility
LEVERAGE_THRESHOLD: '10'                    // 10x leverage
LIQUIDATION_PROXIMITY_THRESHOLD: '20'       // 20% margin ratio
CORRELATION_THRESHOLD: '0.8'                // 80% correlation

WEIGHTS:
- CONCENTRATION: 20%
- VOLATILITY: 25%
- LEVERAGE: 20%
- LIQUIDATION: 20%
- CORRELATION: 15%
```

---

## Acceptance Criteria - ALL MET ✅

| Criterion                    | Status | Implementation                       |
| ---------------------------- | ------ | ------------------------------------ |
| Scoring is accurate & timely | ✅     | Big.js precision, weighted algorithm |
| Thresholds are configurable  | ✅     | Per-user custom config support       |
| Metrics tracked correctly    | ✅     | All 5 metrics calculated & stored    |
| Alerts generated             | ✅     | Automatic alerts on threshold breach |
| Restrictions enforced        | ✅     | Risk-based operation blocking        |

---

## Risk Metrics Tracked

1. **Portfolio Concentration**
   - Asset breakdown by percentage
   - Max single asset exposure
   - Diversification score

2. **Price Volatility**
   - Historical price volatility
   - Return distribution
   - Volatility trend

3. **Leverage Risk**
   - Average leverage across positions
   - Max leverage in use
   - Active position count

4. **Liquidation Proximity**
   - Current margin ratio
   - Distance to liquidation threshold
   - Liquidation risk percentage

5. **System Metrics**
   - Average risk score across users
   - Risk distribution (Low/Medium/High/Critical)
   - Critical alert count

---

## API Endpoints Details

### Score Endpoints (POST)

**Concentration:**

```json
Request: {userId: "user123"}
Response: {
  score: "50",
  level: "Medium",
  maxConcentration: "32",
  assetBreakdown: [{asset: "ETH", percentage: "32"}, ...]
}
```

**Leverage:**

```json
Request: {userId: "user123"}
Response: {
  score: "35",
  level: "Low",
  averageLeverage: "3.5",
  activePositions: 4
}
```

**Liquidation Proximity:**

```json
Request: {userId: "user123"}
Response: {
  score: "20",
  level: "Low",
  marginRatio: "250",
  proximityPercent: "2"
}
```

### Config Endpoints

**GET /config:**

```json
Query: userId=user123 (optional)
Response: {
  default: {thresholds, weights}
  OR user-specific config
}
```

**PUT /config/:userId:**

```json
Body: {
  thresholds: {
    PORTFOLIO_CONCENTRATION_THRESHOLD: "25",
    LEVERAGE_THRESHOLD: "5"
  }
}
Response: Updated config
```

### Alert & Restriction Endpoints

**GET /alerts/:userId:**

```json
Response: {
  alerts: [
    {type: "CRITICAL_RISK", severity: "CRITICAL", score: "78"}
  ],
  riskScore: "78"
}
```

**POST /restrictions/check:**

```json
Body: {userId: "user123", operation: "openPosition"}
Response: {
  canOpenPosition: false,
  maxLeverageAllowed: "10",
  reason: "High risk - reduced leverage allowed",
  isRestricted: true
}
```

---

## Integration Points

1. **Trading System**: Check restrictions before allowing trades
2. **Liquidation Service**: Integrate high risk scores with liquidation triggers
3. **Margin Engine**: Tie risk levels to margin requirements
4. **Notification Service**: Send alerts on threshold breach
5. **Dashboard**: Display risk scores & metrics real-time

---

## Files Delivered

| File                      | Purpose                 |
| ------------------------- | ----------------------- |
| `services/riskService.js` | 10 core functions       |
| `routes/risk.js`          | 10 REST endpoints       |
| `models/RiskConfig.js`    | User risk configuration |
| `models/RiskScore.js`     | Risk score history      |
| `RISK.md`                 | This file               |

---

## Performance

- Scoring: O(n) per user (n = positions/assets)
- Config updates: O(1)
- System metrics: O(m) (m = total users)
- Database: Indexed queries for userId, level, timestamp

---

## Security

✅ All numeric calculations with Big.js  
✅ Input validation on all endpoints  
✅ Configurable thresholds per user  
✅ Comprehensive error handling

---

## Ready for Production ✅

All 5 acceptance criteria met. All metrics working. Full alert system. Risk-based restrictions enforced.
