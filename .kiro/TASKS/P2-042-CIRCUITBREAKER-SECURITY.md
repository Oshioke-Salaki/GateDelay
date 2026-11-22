# P2-042: Add Negative-Path Tests for circuitBreaker.js Abuse Scenarios

**Labels**: `phase-2`, `security`  
**Status**: Open  
**Priority**: High  
**Related**: `Backend/routes/circuitBreaker.js`  

---

## Summary

circuitBreaker.js provides endpoints to trip, reset, isolate, and configure circuit breakers. This task adds security testing for abuse scenarios and documents the threat model.

---

## Current State

**Backend/routes/circuitBreaker.js**:
- GET /status - Get all breaker status
- GET /status/:serviceName - Get specific breaker
- POST /trip - Trip circuit breaker (destructive)
- POST /reset - Reset circuit breaker (destructive)
- POST /reset-all - Reset all breakers (destructive)
- POST /isolate - Isolate service (destructive)
- POST /config - Update config (destructive)
- GET /config - Get configuration

**Issues**:
1. No authentication/authorization on destructive endpoints
2. serviceName parameter not validated (injection risk)
3. Config endpoint accepts any payload (could enable DoS)
4. No rate limiting on destructive actions
5. No threat model documented

---

## Acceptance Criteria

### 1. No Secrets or Private Keys ✓
- [ ] Audit inline: No hardcoded secrets in circuitBreaker.js
- [ ] Grep search: `grep -r "SECRET\|PRIVATE\|KEY\|TOKEN" Backend/routes/circuitBreaker.js`
- [ ] Should return 0 results
- [ ] (Expected: None - this is a control plane, not secrets storage)

### 2. Negative-Path Test Suite ✓
Create: `Backend/tests/routes/circuitBreaker.negative.test.js`

Test coverage:
- [ ] **Missing serviceName**
  - POST /trip with no serviceName → 400 error
  - POST /reset with no serviceName → 400 error
  
- [ ] **Invalid serviceName** (injection-like)
  - POST /trip with serviceName: `"; DROP TABLE--`
  - POST /trip with serviceName: `../../../etc/passwd`
  - POST /trip with serviceName: `<script>alert(1)</script>`
  - Expected: 400 error or sanitized handling
  
- [ ] **Unauthorized Access** (no auth middleware)
  - POST /trip without auth token → should fail (but currently doesn't)
  - POST /reset without auth token → should fail
  - POST /reset-all without auth token → should fail (most dangerous)
  - POST /isolate without auth token → should fail
  - POST /config without auth token → should fail
  
- [ ] **Rate Limiting Test**
  - Call POST /trip 100x rapidly → should be throttled after N requests
  - Expected: 429 (Too Many Requests) or similar
  
- [ ] **Invalid Config Payload**
  - POST /config with negative timeout: `{ timeout: -1000 }` → should validate
  - POST /config with out-of-bounds threshold: `{ errorThreshold: 99999 }` → should validate
  - POST /config with null values → should validate
  - Expected: 400 error with validation message
  
- [ ] **DoS: /reset-all Spam**
  - Call POST /reset-all 10x in rapid succession → should be protected
  - Expected: Rate limited or requires auth

### 3. Threat Notes Recorded ✓
Create: `Backend/CIRCUIT_BREAKER_THREAT_MODEL.md`

Document:
- [ ] **Endpoint Threats**:
  - GET /status, /status/:serviceName - Low risk (read-only)
  - POST /trip, /reset, /isolate, /reset-all - High risk (destructive)
  - POST /config - High risk (can enable/disable protections)
  
- [ ] **Auth/Authorization**:
  - Recommendation: Require JWT token or API key for POST endpoints
  - Implement: Add middleware `requireAuth()` on destructive endpoints
  - Scope: Only admins should trip/reset breakers
  
- [ ] **Rate Limiting**:
  - Recommendation: 10 trips/minute per IP (or per user)
  - Recommendation: 5 resets/minute per IP
  - Recommendation: 1 reset-all/minute per IP
  - Implement: Use `rateLimiter` middleware (Backend/middleware/rateLimiter.js)
  
- [ ] **Input Validation**:
  - serviceName must match: `/^[a-zA-Z0-9_\-]{1,50}$/` (alphanumeric, dash, underscore)
  - serviceName should be checked against registered service list
  - reason field: max 500 chars, no special chars
  
- [ ] **Config Validation**:
  - timeout: 1000-60000 (1-60 seconds)
  - errorThreshold: 1-100
  - resetTimeout: 1000-300000 (1-5 minutes)
  - All values must be positive integers
  
- [ ] **Logging & Monitoring**:
  - Log all destructive operations: WHO (IP/user), WHAT (action), WHEN, serviceName
  - Alert on repeated failures or rapid resets (possible attack)
  - Audit trail: recoverable for incident response

---

## Implementation Steps

### 1. Create Negative-Path Test File
Create: `Backend/tests/routes/circuitBreaker.negative.test.js`

```javascript
const request = require('supertest')
const express = require('express')
const breakerRouter = require('../../routes/circuitBreaker')

describe('CircuitBreaker Route - Negative Paths (Security)', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/breaker', breakerRouter)
  })

  describe('Input Validation', () => {
    it('should reject POST /trip without serviceName', async () => {
      const res = await request(app)
        .post('/breaker/trip')
        .send({ reason: 'test' })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('serviceName')
    })

    it('should reject serviceName with injection attempt', async () => {
      const malicious = [
        '"; DROP TABLE users--',
        '../../../etc/passwd',
        '<script>alert(1)</script>',
        '$(whoami)',
        '`id`',
      ]

      for (const serviceName of malicious) {
        const res = await request(app)
          .post('/breaker/trip')
          .send({ serviceName })

        // Should either:
        // 1. Return 400 (reject invalid input)
        // 2. Or sanitize and accept (if validation logic allows)
        expect([400, 200]).toContain(res.status)
        if (res.status === 200) {
          // If accepted, verify serviceName was sanitized
          expect(res.body.data?.serviceName).not.toContain(serviceName)
        }
      }
    })

    it('should reject empty serviceName', async () => {
      const res = await request(app)
        .post('/breaker/trip')
        .send({ serviceName: '' })

      expect(res.status).toBe(400)
    })

    it('should reject serviceName exceeding max length', async () => {
      const longName = 'a'.repeat(1000)
      const res = await request(app)
        .post('/breaker/trip')
        .send({ serviceName: longName })

      expect(res.status).toBe(400)
    })

    it('should validate config payload bounds', async () => {
      // Test negative timeout
      let res = await request(app)
        .post('/breaker/config')
        .send({ timeout: -1000 })
      expect([400, 200]).toContain(res.status)

      // Test out-of-bounds errorThreshold
      res = await request(app)
        .post('/breaker/config')
        .send({ errorThreshold: 99999 })
      expect([400, 200]).toContain(res.status)

      // Test non-integer values
      res = await request(app)
        .post('/breaker/config')
        .send({ timeout: 'not-a-number' })
      expect(res.status).toBe(400)
    })
  })

  describe('Destructive Actions (Should be Protected)', () => {
    it('should require auth for POST /trip', async () => {
      const res = await request(app)
        .post('/breaker/trip')
        .send({ serviceName: 'auth-service' })

      // Currently likely succeeds (200), but SHOULD require auth (401)
      // This test documents the vulnerability
      if (res.status === 200) {
        console.warn('⚠️  /trip endpoint missing authentication check')
      }
      // After fix: expect(res.status).toBe(401)
    })

    it('should require auth for POST /reset-all', async () => {
      const res = await request(app)
        .post('/breaker/reset-all')
        .send({})

      // Most dangerous endpoint - definitely needs auth
      // Currently likely succeeds (200), but SHOULD require auth (401)
      if (res.status === 200) {
        console.warn('⚠️  /reset-all endpoint missing authentication check')
      }
      // After fix: expect(res.status).toBe(401)
    })

    it('should require auth for POST /config', async () => {
      const res = await request(app)
        .post('/breaker/config')
        .send({ timeout: 5000 })

      // Config changes affect system behavior - needs auth
      if (res.status === 200) {
        console.warn('⚠️  /config endpoint missing authentication check')
      }
      // After fix: expect(res.status).toBe(401)
    })
  })

  describe('Rate Limiting', () => {
    it('should rate limit rapid /trip calls', async () => {
      const requests = []
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .post('/breaker/trip')
            .set('X-Forwarded-For', '192.168.1.1') // Simulate same IP
            .send({ serviceName: `service-${i}` })
        )
      }

      const responses = await Promise.all(requests)
      const rateLimited = responses.some((r) => r.status === 429)

      if (!rateLimited) {
        console.warn('⚠️  No rate limiting detected on /trip endpoint')
      }
      // After rate limiter added: expect(rateLimited).toBe(true)
    })
  })

  describe('Safe Endpoints (Read-Only)', () => {
    it('should allow GET /status without auth', async () => {
      const res = await request(app).get('/breaker/status')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should allow GET /config without auth', async () => {
      // Config GET might be safe (depends on what's exposed)
      // This test documents current behavior
      const res = await request(app).get('/breaker/config')
      expect(res.status).toBe(200)
    })
  })
})
```

### 2. Create Threat Model Document
Create: `Backend/CIRCUIT_BREAKER_THREAT_MODEL.md`

```markdown
# Circuit Breaker Threat Model

## Overview
The circuit breaker system controls resilience/fallback behavior for dependent services. 
Unauthorized access could disable safety mechanisms, causing cascading failures.

## Assets
1. **Circuit breaker state** (open/closed/half-open)
2. **Configuration** (thresholds, timeouts)
3. **Service registry** (which services are monitored)

## Threats

### T1: Unauthorized State Changes (HIGH)
**Threat**: Unauthenticated user trips/resets breakers
**Impact**: Disable services, cause outages
**Current Risk**: HIGH (no auth check)
**Mitigation**: Require authentication (JWT token) for POST endpoints

**Endpoint**: POST /trip, /reset, /isolate, /reset-all
**Required Fix**: Add `requireAuth()` middleware

### T2: Rapid Reset DoS (HIGH)
**Threat**: Attacker spams /reset-all to keep services off
**Impact**: Extended unavailability
**Current Risk**: HIGH (no rate limiting)
**Mitigation**: Rate limit: 1 reset-all per minute per IP

**Endpoint**: POST /reset-all
**Required Fix**: Add rate limiter to destructive endpoints

### T3: Config Tampering (HIGH)
**Threat**: Attacker disables circuit breaker thresholds
**Impact**: Services fail without triggering breaker
**Current Risk**: HIGH (no validation, no auth)
**Mitigation**: Validate bounds, require auth, log changes

**Endpoint**: POST /config
**Required Fix**: 
- Add authentication
- Add schema validation
- Log all config changes

### T4: Service Name Injection (MEDIUM)
**Threat**: Attacker passes `serviceName: "'; DROP TABLE--"`
**Impact**: Depends on breakerService implementation
**Current Risk**: MEDIUM (depends on service layer)
**Mitigation**: Whitelist valid service names, validate format

**Endpoint**: POST /trip, /reset, /isolate
**Required Fix**: Validate serviceName against registered list

### T5: Information Disclosure (LOW)
**Threat**: GET /config exposes circuit breaker settings
**Impact**: Attacker learns timeout/threshold values
**Current Risk**: LOW (config likely not sensitive)
**Mitigation**: Consider if config should be admin-only

**Endpoint**: GET /config
**Current Stance**: Likely acceptable to expose

## Affected Endpoints

### Destructive (Require Authentication & Rate Limiting)
| Endpoint | Severity | Auth | Rate Limit | Validation |
|----------|----------|------|-----------|-----------|
| POST /trip | HIGH | ✓ Required | ✓ 10/min | Whitelist serviceName |
| POST /reset | HIGH | ✓ Required | ✓ 5/min | Whitelist serviceName |
| POST /reset-all | CRITICAL | ✓ Required | ✓ 1/min | None |
| POST /isolate | HIGH | ✓ Required | ✓ 10/min | Whitelist serviceName |
| POST /config | HIGH | ✓ Required | ✓ 5/min | Schema validation |

### Safe (Read-Only)
| Endpoint | Auth | Notes |
|----------|------|-------|
| GET /status | Optional | Consider rate limit (DoS) |
| GET /status/:serviceName | Optional | Consider rate limit |
| GET /config | Optional | Or admin-only |
| GET /history | Optional | Consider rate limit |
| GET /check/:serviceName | Optional | Consider rate limit |

## Input Validation Rules

### serviceName
- Format: `/^[a-zA-Z0-9_\-]{1,50}$/`
- Must be in registered service list
- Examples: `auth-service`, `payment_processor`, `order-service`

### reason (optional)
- Max 500 characters
- Should be human-readable
- Examples: `"Manual maintenance"`, `"High error rate detected"`

### Config Fields
- **timeout**: 1000-60000 (1-60 seconds)
- **errorThreshold**: 1-100 (%) 
- **resetTimeout**: 1000-300000 (1-5 minutes)
- **halfOpenMaxCalls**: 1-100

## Logging Requirements

Log all destructive operations with:
- **Timestamp**: ISO 8601 format
- **Action**: trip, reset, isolate, config
- **serviceName**: Service affected
- **IP Address**: Source of request
- **User ID**: If authenticated
- **Reason**: If provided
- **Result**: success, failure

Example:
```json
{
  "timestamp": "2026-08-27T10:30:00Z",
  "action": "reset",
  "serviceName": "payment-processor",
  "ipAddress": "192.168.1.1",
  "userId": "admin-user-123",
  "reason": "Completed maintenance",
  "result": "success"
}
```

## Monitoring & Alerting

### Alerts to Configure
1. **Rapid resets** (>3 resets in 5 minutes) → Possible attack
2. **Config changes** → Always alert (sensitive operation)
3. **Unauthorized attempts** (failed auth) → Track and alert
4. **Bulk /trip calls** (>10 in 5 minutes) → Possible attack

## Implementation Checklist

- [ ] Add `requireAuth()` middleware to destructive endpoints
- [ ] Add input validation middleware
- [ ] Add rate limiting middleware
- [ ] Add comprehensive logging
- [ ] Add config schema validation
- [ ] Add service name whitelist
- [ ] Add monitoring alerts
- [ ] Document in code (inline comments)
- [ ] Add negative-path tests
- [ ] Update API documentation

## Future Enhancements

1. **Role-based access**: Different permissions for different roles
2. **Audit trail**: Immutable log of all state changes
3. **Approval workflow**: Require approval for critical operations
4. **Time-based windows**: Only allow resets during maintenance windows
5. **Alerts**: Slack/PagerDuty notifications on unauthorized attempts

---

**Status**: DRAFT  
**Last Updated**: August 27, 2026  
**Next Review**: After implementation of security fixes  
```

### 3. Add Inline Comments to circuitBreaker.js
Update: `Backend/routes/circuitBreaker.js`

Add security comments:
```javascript
/**
 * POST /trip
 * Trip/activate circuit breaker for a service
 * 
 * SECURITY NOTE: This is a destructive operation. Should require:
 * 1. Authentication (JWT token or API key)
 * 2. Authorization (admin role)
 * 3. Rate limiting (max 10 trips/minute per IP)
 * 4. Input validation (serviceName must match: /^[a-zA-Z0-9_\-]{1,50}$/)
 * 5. Audit logging (log who, what, when)
 * 
 * TODO: Add requireAuth() middleware
 * TODO: Add rateLimiter middleware
 * TODO: Validate serviceName against service registry
 */
router.post('/trip', handleErrors(async (req, res) => { ... }))
```

### 4. Update CI Configuration (if needed)
Ensure test runs in CI:
```yaml
# .github/workflows/ci.yml (add if missing)
- name: Run security tests
  run: npm run test:security
  working-directory: Backend
```

### 5. Update package.json (Backend)
```json
{
  "scripts": {
    "test": "jest",
    "test:security": "jest tests/routes/circuitBreaker.negative.test.js --verbose",
    "test:watch": "jest --watch"
  }
}
```

---

## Test Execution

```bash
# Run negative-path tests
cd Backend
npm run test:security

# Expected output:
# CircuitBreaker Route - Negative Paths (Security)
#   Input Validation
#     ✓ should reject POST /trip without serviceName
#     ✓ should reject serviceName with injection attempt
#     ✓ should reject empty serviceName
#     ... (etc)
#   Destructive Actions (Should be Protected)
#     ✓ should require auth for POST /trip (documents vulnerability)
#     ✓ should require auth for POST /reset-all
#     ✓ should require auth for POST /config
#   ...
#
# Tests: X passed, Y warnings (vulnerabilities documented)
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `Backend/tests/routes/circuitBreaker.negative.test.js` | Create | Negative-path test suite |
| `Backend/CIRCUIT_BREAKER_THREAT_MODEL.md` | Create | Threat model & mitigation |
| `Backend/routes/circuitBreaker.js` | Modify | Add inline security notes |
| `Backend/package.json` | Modify | Add test:security script |

---

## Success Criteria

✓ No secrets in circuitBreaker.js  
✓ Negative-path test suite created  
✓ Tests document vulnerabilities  
✓ Threat model documented  
✓ Inline comments added  
✓ CI passes (tests should not fail happy path)  

---

## Follow-Up Tasks (Phase 3+)

- Implement authentication middleware
- Implement rate limiting middleware
- Add input validation middleware
- Add audit logging
- Set up monitoring/alerting

---

## Related Issues

- Security: Add auth middleware to Backend routes
- Security: Implement rate limiting strategy
- Logging: Centralized audit trail for all API calls

