/**
 * Smoke test script for health endpoints used by local development and CI.
 * Set SMOKE_TARGETS to a comma-separated list of targets: nest, express.
 */

const http = require('http');

const EXPRESS_PORT = process.env.EXPRESS_PORT || 4000;
const NEST_PORT = process.env.NEST_PORT || 3000;
const attempts = Number(process.env.SMOKE_ATTEMPTS || 20);
const delayMs = Number(process.env.SMOKE_DELAY_MS || 1000);
const targets = (process.env.SMOKE_TARGETS || 'nest')
  .split(',')
  .map((target) => target.trim().toLowerCase())
  .filter(Boolean);

function checkHealth(url, name) {
  return new Promise((resolve) => {
    const request = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          const healthy = res.statusCode >= 200 && res.statusCode < 300 && body.status === 'ok';
          console.log(`${healthy ? '✓' : '✗'} ${name}: ${res.statusCode}`);
          resolve(healthy);
        } catch {
          console.log(`✗ ${name}: Invalid JSON response`);
          resolve(false);
        }
      });
    });

    request.setTimeout(5000, () => {
      request.destroy(new Error('request timed out'));
    });
    request.on('error', (error) => {
      console.log(`✗ ${name}: ${error.message}`);
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkWithRetry(url, name) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await checkHealth(url, name)) return true;
    if (attempt < attempts) await sleep(delayMs);
  }
  return false;
}

async function runSmokeTests() {
  console.log(`Running smoke tests for: ${targets.join(', ')}`);
  const checks = [];

  if (targets.includes('express')) {
    checks.push(
      checkWithRetry(`http://localhost:${EXPRESS_PORT}/health`, 'Express /health'),
      checkWithRetry(`http://localhost:${EXPRESS_PORT}/health/details`, 'Express /health/details'),
    );
  }
  if (targets.includes('nest')) {
    checks.push(
      checkWithRetry(`http://localhost:${NEST_PORT}/api/health`, 'NestJS /api/health'),
      checkWithRetry(`http://localhost:${NEST_PORT}/api/health/details`, 'NestJS /api/health/details'),
    );
  }

  if (checks.length === 0) {
    console.error('No smoke targets configured. Set SMOKE_TARGETS to nest and/or express.');
    process.exit(1);
  }

  const allPassed = (await Promise.all(checks)).every(Boolean);
  console.log(allPassed ? '✓ All smoke tests passed' : '✗ Some smoke tests failed');
  process.exit(allPassed ? 0 : 1);
}

runSmokeTests();
