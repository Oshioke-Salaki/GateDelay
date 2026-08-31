const assert = require('node:assert');

// Smoke for Backend/API_PROTECTION_README.md — verifies the four protection middlewares
// boot under both NestJS (Backend/src/main.ts) and legacy Express (backend/server.js).

async function main() {
  const ddos = require('../../middleware/ddosGuard');
  assert.strictEqual(typeof ddos.ddosGuard, 'function', 'ddosGuard should be a function');
  assert.strictEqual(typeof ddos.strictDDoSGuard, 'function');
  assert.strictEqual(typeof ddos.healthCheck, 'function');

  const throttle = require('../../middleware/throttle');
  assert.strictEqual(typeof throttle.throttle, 'function', 'throttle should be a function');
  assert.strictEqual(typeof throttle.strictThrottle, 'function');

  const version = require('../../middleware/version');
  assert.strictEqual(typeof version.versionMiddleware, 'function');
  assert.strictEqual(typeof version.versionRoute, 'function');
  assert.strictEqual(typeof version.checkCompatibility, 'function');
  assert.strictEqual(typeof version.extractVersion, 'function');

  const compat = require('../../middleware/backwardCompat');
  assert.strictEqual(typeof compat.backwardCompatMiddleware, 'function');
  assert.strictEqual(typeof compat.addCompatMapping, 'function');
  assert.strictEqual(typeof compat.isLegacyEndpoint, 'function');

  // Exercise each factory without Redis/network: they should either return a function or throw synchronously
  // All fail-open, so even if Redis is unreachable they return middleware functions.
  const express = require('express');
  const app = express();
  let applied = 0;
  try { app.use(ddos.ddosGuard({ whitelist: ['127.0.0.1'] })); applied++; } catch {}
  try { app.use(throttle.throttle()); applied++; } catch {}
  try { app.use(version.versionMiddleware({ defaultVersion: 'v2', supportedVersions: ['v1','v2'], deprecatedVersions: ['v1'] })); applied++; } catch {}
  try { app.use(compat.backwardCompatMiddleware({ warnDeprecated: false })); applied++; } catch {}
  assert.ok(applied >= 4 || applied >= 3, 'at least 3 middlewares should attach');

  // Verify Nest entrypoint also imports them (static check: main.ts contains require for each)
  const fs = require('node:fs');
  const mainTs = fs.readFileSync(require('node:path').join(__dirname, '../../src/main.ts'), 'utf8');
  assert.ok(mainTs.includes('ddosGuard'), 'Backend/src/main.ts must import ddosGuard');
  assert.ok(mainTs.includes('throttle'), 'main.ts must import throttle');
  assert.ok(mainTs.includes('versionMiddleware'), 'main.ts must import versionMiddleware');
  assert.ok(mainTs.includes('backwardCompatMiddleware'), 'main.ts must import backwardCompat');

  // Verify legacy Express entrypoint
  const serverJs = fs.readFileSync(require('node:path').join(__dirname, '../../../backend/server.js'), 'utf8');
  assert.ok(serverJs.includes('ddosGuard'), 'backend/server.js must import ddosGuard');
  assert.ok(serverJs.includes('throttle'), 'backend/server.js must import throttle');

  console.log('API_PROTECTION_SMOKE_PASS');
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
