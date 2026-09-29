#!/usr/bin/env node

/**
412 [Backend] Implement market CI/CD pipeline
- Automate testing workflows
- Handle code quality checks
- Manage pipeline stages
- Provide pipeline status
*/

const { spawnSync } = require('child_process');
const path = require('path');

function log(msg) {
  console.log(`[TEST PIPELINE] ${msg}`);
}

function runStage(name, command, args, cwd) {
  log(`--------------------------------------------------`);
  log(`Starting Stage: ${name}`);
  log(`Command: ${command} ${args.join(' ')}`);
  log(`--------------------------------------------------`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    log(`Stage: ${name} - FAILED (exit code: ${result.status})`);
    return false;
  }

  log(`Stage: ${name} - PASSED`);
  return true;
}

function main() {
  const backendDir = path.join(__dirname, '..');
  log('Starting local CI/CD verification pipeline...');

  // Stage 1: Lint & Code Quality Checks
  const lintPassed = runStage(
    'Code Quality Check (Linting)',
    'npm',
    ['run', 'lint'],
    backendDir
  );

  if (!lintPassed) {
    log('Pipeline failed at Lint stage. Aborting.');
    process.exit(1);
  }

  // Stage 2: Automate testing workflows (Run Jest tests)
  const testsPassed = runStage(
    'Unit & Integration Tests',
    'npm',
    ['run', 'test'],
    backendDir
  );

  if (!testsPassed) {
    log('Pipeline failed at Test stage. Aborting.');
    process.exit(1);
  }

  log('==================================================');
  log('CI/CD PIPELINE STATUS: ALL STAGES PASSED');
  log('==================================================');
  process.exit(0);
}

if (require.main === module) {
  main();
}
