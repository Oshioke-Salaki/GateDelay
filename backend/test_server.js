const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');
const http = require('http');

console.log('=== RUNNING EXPRESS SERVER INTEGRATION TESTS ===\n');

function runServerProcess(env = {}) {
  return new Promise((resolve) => {
    const serverPath = path.join(__dirname, 'server.js');
    const child = spawn('node', [serverPath], {
      env: { ...process.env, ...env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // If we expect it to start successfully, we'll terminate it manually
    // once we verify `/health`. So we return a handle as well as promise resolution.
    resolve({ child, getLogs: () => ({ stdout, stderr }) });
  });
}

function fetchHealth(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Successful Boot on Default Port
  try {
    console.log('[Test 1] Testing normal boot on PORT 8085...');
    const port = '8085';
    const { child, getLogs } = await runServerProcess({ PORT: port, FATAL_BOOT_TRIGGER: 'false', NODE_ENV: 'development' });

    // Wait a bit for server to spin up
    await new Promise((r) => setTimeout(r, 2000));

    const health = await fetchHealth(port);
    assert.strictEqual(health.statusCode, 200, 'Health check should return status 200');
    assert.strictEqual(health.body.status, 'ok', 'Health response status should be ok');
    assert.ok(health.body.timestamp, 'Health response should contain a timestamp');

    const logs = getLogs();
    assert.ok(logs.stdout.includes(`GateDelay backend running on port ${port}`), 'Logs should contain the port message');
    assert.ok(logs.stdout.includes('[Boot Diagnostics] Environment validation successful.'), 'Logs should confirm validation');

    // Terminate the running server
    child.kill('SIGTERM');
    console.log('✅ [Test 1] Passed!\n');
    passed++;
  } catch (err) {
    console.error('❌ [Test 1] Failed:', err);
    failed++;
  }

  // Test 2: Induced Fatal Boot Failure via FATAL_BOOT_TRIGGER
  try {
    console.log('[Test 2] Testing induced boot failure via FATAL_BOOT_TRIGGER...');
    const { child } = await runServerProcess({ FATAL_BOOT_TRIGGER: 'true' });

    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    assert.strictEqual(exitCode, 1, 'Process should exit with status code 1');
    console.log('✅ [Test 2] Passed!\n');
    passed++;
  } catch (err) {
    console.error('❌ [Test 2] Failed:', err);
    failed++;
  }

  // Test 3: Missing Critical Secret in Production
  try {
    console.log('[Test 3] Testing missing JWT_SECRET in production environment...');
    const { child } = await runServerProcess({ NODE_ENV: 'production', JWT_SECRET: '' });

    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code));
    });

    assert.strictEqual(exitCode, 1, 'Process should exit with status code 1');
    console.log('✅ [Test 3] Passed!\n');
    passed++;
  } catch (err) {
    console.error('❌ [Test 3] Failed:', err);
    failed++;
  }

  console.log(`=== TEST SUMMARY: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
