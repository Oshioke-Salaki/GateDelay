/**
 * Smoke test script for health endpoints
 * Used for local development and CI/CD probes
 */

const http = require('http');

const EXPRESS_PORT = process.env.EXPRESS_PORT || 4000;
const NEST_PORT = process.env.NEST_PORT || 3000;

async function checkHealth(url, name) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          console.log(`✓ ${name}: ${res.statusCode} - ${JSON.stringify(body)}`);
          resolve(true);
        } catch (e) {
          console.log(`✗ ${name}: Invalid JSON response`);
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.log(`✗ ${name}: ${err.message}`);
      resolve(false);
    });
  });
}

async function runSmokeTests() {
  console.log('Running smoke tests...\n');

  const expressBasic = await checkHealth(
    `http://localhost:${EXPRESS_PORT}/health`,
    'Express /health'
  );

  const expressDetails = await checkHealth(
    `http://localhost:${EXPRESS_PORT}/health/details`,
    'Express /health/details'
  );

  const nestBasic = await checkHealth(
    `http://localhost:${NEST_PORT}/api/health`,
    'NestJS /api/health'
  );

  const nestDetails = await checkHealth(
    `http://localhost:${NEST_PORT}/api/health/details`,
    'NestJS /api/health/details'
  );

  console.log('\n--- Summary ---');
  const allPassed = expressBasic && expressDetails && nestBasic && nestDetails;
  
  if (allPassed) {
    console.log('✓ All smoke tests passed');
    process.exit(0);
  } else {
    console.log('✗ Some smoke tests failed');
    process.exit(1);
  }
}

runSmokeTests();
