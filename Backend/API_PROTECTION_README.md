# API Protection & Versioning System

This document describes the DDoS protection, throttling, versioning, and backward compatibility features implemented for the backend API.

## Features Overview

### 1. DDoS Protection (#399)
- Real-time attack pattern detection
- IP reputation scoring
- Automatic request filtering
- IP blacklisting with configurable duration
- Attack mitigation strategies
- Comprehensive protection reports

### 2. Request Throttling (#400)
- User-based and IP-based rate limiting
- Dynamic throttling limits
- Pattern analysis and abuse detection
- Endpoint-specific throttling
- Real-time analytics

### 3. API Versioning (#401)
- Multiple versioning strategies (header, URL, query)
- Version-specific routing
- Deprecation warnings
- Feature compatibility checking
- Migration documentation

### 4. Backward Compatibility (#402)
- Legacy endpoint mapping
- Automatic request/response transformation
- Field name conversion (snake_case ↔ camelCase)
- Graceful deprecation notices
- Migration guides

## Installation

All dependencies are already included in `package.json`:
- `ioredis` - Redis client for rate limiting and caching
- `express` - Web framework

## Quick Start

### Basic Setup

```javascript
const express = require('express');
const app = express();

// Import middlewares
const { ddosGuard } = require('./middleware/ddosGuard');
const { throttle } = require('./middleware/throttle');
const { versionMiddleware } = require('./middleware/version');
const { backwardCompatMiddleware } = require('./middleware/backwardCompat');

// Apply global protection
app.use(ddosGuard());
app.use(throttle());
app.use(versionMiddleware());
app.use(backwardCompatMiddleware());

// Your routes
app.use('/api', require('./routes/api.example'));
```

## DDoS Protection

### Middleware Usage

```javascript
const { ddosGuard, strictDDoSGuard } = require('./middleware/ddosGuard');

// Standard protection
app.use(ddosGuard({
  autoMitigate: true,
  blockOnAttack: true,
  whitelist: ['127.0.0.1'],
}));

// Strict protection for sensitive endpoints
app.post('/api/trading', strictDDoSGuard(), handler);
```

### Service API

```javascript
const ddosProtection = require('./services/ddosProtection');

// Track request
await ddosProtection.trackRequest(ip, metadata);

// Detect attack
const detection = await ddosProtection.detectAttack(ip);

// Blacklist IP
await ddosProtection.blacklistIP(ip, duration, reason);

// Check blacklist
const status = await ddosProtection.isBlacklisted(ip);

// Generate report
const report = await ddosProtection.generateReport('day');

// Get status
const status = await ddosProtection.getStatus();
```

### Attack Patterns Detected

1. **Rapid Fire** - Too many requests per second
2. **Slowloris** - Long connections with minimal data
3. **HTTP Flood** - Excessive requests per minute
4. **Distributed** - Coordinated attack from multiple IPs

## Request Throttling

### Middleware Usage

```javascript
const { throttle, strictThrottle } = require('./middleware/throttle');

// Global throttling
app.use(throttle({
  endpointSpecific: false,
}));

// Endpoint-specific throttling
app.get('/api/data', throttle({ endpointSpecific: true }), handler);

// Strict throttling
app.post('/api/trading', strictThrottle(5, 60), handler);
```

### Service API

```javascript
const throttleService = require('./services/throttleService');

// Set custom rule
throttleService.setRule('custom', {
  requests: 100,
  window: 60,
  burst: 20,
});

// Track pattern
await throttleService.trackPattern(userId, metadata);

// Analyze pattern
const analysis = await throttleService.analyzePattern(userId);

// Set dynamic limit
await throttleService.setDynamicLimit(identifier, 500, 60);

// Get analytics
const analytics = await throttleService.getAnalytics('hour');

// Reset user
await throttleService.resetUser(userId);
```

### Default Throttle Rules

- **Public**: 60 requests/min
- **Authenticated**: 300 requests/min
- **Premium**: 1000 requests/min
- **Trading**: 100 requests/min

## API Versioning

### Middleware Usage

```javascript
const { versionMiddleware, versionRoute } = require('./middleware/version');

// Version detection
app.use(versionMiddleware({
  defaultVersion: 'v2',
  supportedVersions: ['v1', 'v2'],
  deprecatedVersions: ['v1'],
}));

// Version routing
app.use('/api', versionRoute({
  v1: v1Routes,
  v2: v2Routes,
  default: v2Routes,
}));
```

### Version Detection Methods

1. **Header**: `X-API-Version: v2`
2. **URL Path**: `/api/v2/users`
3. **Query**: `/api/users?version=v2`
4. **Accept Header**: `Accept: application/vnd.api.v2+json`

### Feature Compatibility

```javascript
const { checkCompatibility } = require('./middleware/version');

// Require minimum version
app.post('/api/feature', checkCompatibility('advanced', 'v2'), handler);
```

### Response Headers

```
X-API-Version: v2
X-API-Deprecation: true
X-API-Deprecation-Version: v1
X-API-Sunset: 2025-12-31
```

## Backward Compatibility

### Middleware Usage

```javascript
const { backwardCompatMiddleware } = require('./middleware/backwardCompat');

app.use(backwardCompatMiddleware({
  warnDeprecated: true,
  logUsage: true,
}));
```

### Legacy Endpoint Mapping

```javascript
const { addCompatMapping } = require('./middleware/backwardCompat');

addCompatMapping('/old/path', '/new/path', {
  method: 'POST',
  request: (data) => ({
    newField: data.oldField,
  }),
  response: (data) => ({
    oldField: data.newField,
  }),
});
```

### Field Transformations

Automatic conversion between naming conventions:
- `order_id` ↔ `orderId`
- `user_id` ↔ `userId`
- `created_at` ↔ `createdAt`

### Legacy Routes

All legacy endpoints under `/legacy/*` are automatically mapped to new implementations.

## Admin Endpoints

### DDoS Management

```bash
# Get status
GET /admin/ddos/status

# Get report
GET /admin/ddos/report?period=day

# Blacklist IP
POST /admin/ddos/blacklist
{
  "ip": "1.2.3.4",
  "duration": 3600,
  "reason": "Attack detected"
}

# Remove from blacklist
DELETE /admin/ddos/blacklist/1.2.3.4
```

### Throttle Management

```bash
# Get analytics
GET /admin/throttle/analytics?period=hour

# Get user status
GET /admin/throttle/user/:userId

# Set dynamic limit
POST /admin/throttle/dynamic-limit
{
  "identifier": "user:123",
  "limit": 500,
  "window": 60
}

# Reset user
DELETE /admin/throttle/reset/:userId
```

## Configuration

### Environment Variables

```env
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DDOS_DB=5
REDIS_THROTTLE_DB=6

# DDoS configuration
DDOS_REQUESTS_PER_SECOND=100
DDOS_REQUESTS_PER_MINUTE=1000
DDOS_BLACKLIST_DURATION=3600

# Throttle configuration
THROTTLE_DEFAULT_LIMIT=60
THROTTLE_DEFAULT_WINDOW=60
```

## Response Headers

### Rate Limiting

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T00:00:00Z
Retry-After: 30
```

### Versioning

```
X-API-Version: v2
X-Endpoint-Deprecated: true
X-Deprecation-Warning: This endpoint is deprecated
```

### Compatibility

```
X-Compatibility-Warning: Endpoint moved
X-Migration-Guide: https://docs.example.com/migration
X-Sunset-Date: 2025-12-31
```

## Error Responses

### Rate Limited

```json
{
  "success": false,
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "limit": 100,
  "retryAfter": 30,
  "resetTime": "2024-01-01T00:00:00Z"
}
```

### DDoS Detected

```json
{
  "success": false,
  "error": "Request blocked",
  "code": "DDOS_DETECTED"
}
```

### Version Not Supported

```json
{
  "success": false,
  "error": "Unsupported API version",
  "code": "UNSUPPORTED_VERSION",
  "requestedVersion": "v3",
  "supportedVersions": ["v1", "v2"]
}
```

## Testing

### Test DDoS Protection

```bash
# Rapid requests (should trigger detection)
for i in {1..200}; do
  curl http://localhost:3000/api/test &
done

# Check blacklist
curl http://localhost:3000/admin/ddos/status
```

### Test Throttling

```bash
# Exceed rate limit
for i in {1..100}; do
  curl http://localhost:3000/api/data
done
```

### Test Versioning

```bash
# Header-based
curl -H "X-API-Version: v2" http://localhost:3000/api/users

# URL-based
curl http://localhost:3000/api/v2/users

# Query-based
curl http://localhost:3000/api/users?version=v2
```

## Best Practices

1. **DDoS Protection**
   - Whitelist known IPs
   - Monitor attack reports regularly
   - Adjust thresholds based on traffic patterns

2. **Throttling**
   - Use endpoint-specific limits for sensitive operations
   - Set dynamic limits for premium users
   - Monitor abuse patterns

3. **Versioning**
   - Always specify deprecation timeline
   - Provide migration guides
   - Support at least 2 versions

4. **Backward Compatibility**
   - Log legacy endpoint usage
   - Set sunset dates
   - Provide clear migration paths

## Monitoring

All services log to console. Integrate with your logging system:

```javascript
// Custom logger
ddosProtection.logger = yourLogger;
throttleService.logger = yourLogger;
```

## Performance

- Redis operations are optimized for speed
- Middleware fails open on errors
- Minimal overhead per request (<1ms)
- Supports high-throughput scenarios

## Support

For issues or questions:
- Check logs for error details
- Review Redis connection
- Verify configuration
- Check rate limit headers

## License

MIT
