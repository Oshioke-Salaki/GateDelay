/**
 * Jest config for the CommonJS half of Backend/ (models/, middleware/, ...).
 *
 * The default config in package.json sets `rootDir: "src"` and
 * `testRegex: ".*\\.spec\\.ts$"`, so `npm test` only ever runs the NestJS
 * `.spec.ts` suites. Every `.test.js` under test/ and tests/ is invisible to it.
 *
 * `testMatch` below is an explicit allowlist rather than a glob over all of
 * test/: the wider legacy suite has never run in CI and is not known to pass,
 * so opting files in one at a time keeps this signal trustworthy. Add a file
 * here once it is green.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/tradeValidation.test.js',
    '<rootDir>/test/staleOracleData.test.js',
    '<rootDir>/test/disputeModel.test.js',
    '<rootDir>/test/multisig.test.js',
    '<rootDir>/test/multisig.routes.test.js',
    '<rootDir>/test/circuitBreaker.test.js',
    '<rootDir>/test/bridge.test.js',
    '<rootDir>/test/tradeEngine.test.js',
    '<rootDir>/test/staleOracleData.test.js',
    '<rootDir>/test/marketMigrationValidation.test.js',
    '<rootDir>/test/gracefulShutdown.test.js',
    '<rootDir>/test/migrationSmoke.test.js',
  ],
  clearMocks: true,
  // mongoose registers internal handles as soon as it is required, even without
  // a connection, so the worker will not exit on its own. These suites are pure
  // schema/unit checks with nothing to drain.
  forceExit: true,
};
