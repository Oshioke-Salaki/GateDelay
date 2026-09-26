const express = require('express');
const cors = require('cors');

// Local routes (services and routes co-located in backend/)
const migrationRoutes = require('./routes/migration');
const rollbackRoutes = require('./routes/rollback');
const healthRoutes = require('./routes/health');

// Aliased routes (canonical files live in Backend/routes/)
const betaRoutes = require('../Backend/routes/beta');
const oncallRoutes = require('../Backend/routes/oncall');
const restoreRoutes = require('../Backend/routes/restore');
const upgradeCoordinator = require('./services/upgradeCoordinator');
const upgradeManager = require('./jobs/upgradeManager');
const {
  expressCorrelationMiddleware,
  log,
  withJobContext,
} = require('./utils/correlation');
const {
  expressErrorEnvelopeMiddleware,
  expressErrorHandler,
  expressNotFoundHandler,
  sendError,
} = require('./utils/errorEnvelope');
const rateLimits = require('./config/rateLimits');
const { assertValidRateLimits } = require('./config/rateLimitsValidation');

// API protection middlewares (Backend/API_PROTECTION_README.md) — same stack as NestJS (Backend/src/main.ts)
let ddosGuard, throttle, versionMiddleware, backwardCompatMiddleware;
try {
  ({ ddosGuard } = require('../Backend/middleware/ddosGuard'));
  ({ throttle } = require('../Backend/middleware/throttle'));
  ({ versionMiddleware } = require('../Backend/middleware/version'));
  ({ backwardCompatMiddleware } = require('../Backend/middleware/backwardCompat'));
} catch (err) {
  console.warn('[server] API protection middlewares unavailable:', err.message);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Validate the rate-limit tables before anything binds a port or installs a
// limiter. An unsafe configuration (unreachable tier budgets, a missing Redis
// connection, an open whitelist entry) has to fail the boot rather than boot a
// limiter that quietly does nothing. Throws RateLimitConfigError on failure.
const rateLimitReport = assertValidRateLimits(rateLimits);
for (const warning of rateLimitReport.warnings) {
  console.warn(`[server] ${warning}`);
}

app.use(cors());
app.use(express.json());
app.use(expressCorrelationMiddleware);
app.use(expressErrorEnvelopeMiddleware);

// Apply API protection globally if available (order: DDoS → throttle → version → compat)
try {
  if (typeof ddosGuard === 'function') app.use(ddosGuard({ whitelist: ['127.0.0.1'] }));
  if (typeof throttle === 'function') app.use(throttle());
  if (typeof versionMiddleware === 'function')
    app.use(versionMiddleware({ defaultVersion: 'v2', supportedVersions: ['v1', 'v2'], deprecatedVersions: ['v1'] }));
  if (typeof backwardCompatMiddleware === 'function')
    app.use(backwardCompatMiddleware({ warnDeprecated: true, logUsage: false }));
} catch (err) {
  console.warn('[server] API protection setup failed:', err.message);
}

app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

app.use('/api/migrations', migrationRoutes);
app.use('/api/rollback', rollbackRoutes);
app.use('/api/restore', restoreRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/oncall', oncallRoutes);

app.post('/api/upgrades', (req, res) => {
  try {
    const { version, services, scheduledFor } = req.body;
    if (!version) {
      return sendError(res, { message: 'version is required' }, {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        requestId: req.requestId,
      });
    }
    const upgrade = upgradeCoordinator.createUpgrade({ version, services });
    if (scheduledFor) {
      upgradeCoordinator.scheduleUpgrade(upgrade.id, scheduledFor);
    }
    res.status(201).json({ success: true, data: upgrade });
  } catch (err) {
    sendError(res, err, { statusCode: 400, requestId: req.requestId });
  }
});

app.post('/api/upgrades/:id/start', async (req, res) => {
  try {
    const upgrade = await upgradeCoordinator.startUpgrade(req.params.id);
    res.json({ success: true, data: upgrade });
  } catch (err) {
    sendError(res, err, { statusCode: 400, requestId: req.requestId });
  }
});

app.get('/api/upgrades', (_req, res) => {
  res.json({ success: true, data: upgradeCoordinator.getStatus() });
});

app.get('/api/upgrades/:id', (req, res) => {
  const status = upgradeCoordinator.getProgress(req.params.id);
  if (!status) {
    return sendError(res, { message: 'Upgrade not found' }, {
      statusCode: 404,
      code: 'NOT_FOUND',
      requestId: req.requestId,
    });
  }
  res.json({ success: true, data: status });
});

app.post('/api/upgrades/:id/rollback', async (req, res) => {
  try {
    const result = await upgradeCoordinator.rollbackUpgrade(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err, { statusCode: 400, requestId: req.requestId });
  }
});

withJobContext('upgradeManager.start', {}, ({ requestId }) => {
  log('info', 'Starting upgrade manager', { requestId, job: 'upgradeManager.start' });
  upgradeManager.start();
});

app.use(expressNotFoundHandler);
app.use(expressErrorHandler);

app.listen(PORT, () => {
  log('info', 'GateDelay legacy Express backend running', {
    service: 'gatedelay-backend-express',
    port: PORT,
  });
});

// Boot the standalone heartbeat server (default HEARTBEAT_PORT=4001) in the
// same process so MarketFactory events stay wired into the heartbeat system
// when running the legacy Express entrypoint.
try {
  const { startHeartbeatServer } = require('../Backend/heartbeatServer');
  if (typeof startHeartbeatServer === 'function') {
    startHeartbeatServer().catch((err) => {
      console.warn('[server] heartbeat boot failed:', err.message);
    });
  }
} catch (err) {
  console.warn('[server] heartbeat server unavailable:', err.message);
}

module.exports = app;
