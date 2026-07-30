const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const migrationRoutes = require('./routes/migration');
const rollbackRoutes = require('./routes/rollback');
const restoreRoutes = require('./routes/restore');
const betaRoutes = require('./routes/beta');
const oncallRoutes = require('./routes/oncall');
const upgradeCoordinator = require('./services/upgradeCoordinator');
const upgradeManager = require('./jobs/upgradeManager');

const app = express();

// Diagnostic & Validation Routine
function validateEnvironment() {
  console.log('[Boot Diagnostics] Validating environment variables...');

  if (process.env.FATAL_BOOT_TRIGGER === 'true') {
    throw new Error('Fatal boot dependency failure: Induced by FATAL_BOOT_TRIGGER environment variable.');
  }

  const essentialVars = {
    PORT: process.env.PORT || '8080',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };

  console.log(`[Boot Diagnostics] NODE_ENV: ${essentialVars.NODE_ENV}`);
  console.log(`[Boot Diagnostics] PORT to be used: ${essentialVars.PORT}`);

  // Critical checks for Production
  if (essentialVars.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET) {
      throw new Error('Fatal boot dependency failure: JWT_SECRET environment variable is required in production!');
    }
  } else {
    if (!process.env.JWT_SECRET) {
      console.warn('[Boot Diagnostics] Warning: JWT_SECRET is not set. Using fallback for development.');
    }
  }

  console.log('[Boot Diagnostics] Environment validation successful.');
}

const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/migrations', migrationRoutes);
app.use('/api/rollback', rollbackRoutes);
app.use('/api/restore', restoreRoutes);
app.use('/api/beta', betaRoutes);
app.use('/api/oncall', oncallRoutes);

app.post('/api/upgrades', (req, res) => {
  try {
    const { version, services, scheduledFor } = req.body;
    if (!version) {
      return res.status(400).json({ success: false, error: 'version is required' });
    }
    const upgrade = upgradeCoordinator.createUpgrade({ version, services });
    if (scheduledFor) {
      upgradeCoordinator.scheduleUpgrade(upgrade.id, scheduledFor);
    }
    res.status(201).json({ success: true, data: upgrade });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/upgrades/:id/start', async (req, res) => {
  try {
    const upgrade = await upgradeCoordinator.startUpgrade(req.params.id);
    res.json({ success: true, data: upgrade });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/upgrades', (_req, res) => {
  res.json({ success: true, data: upgradeCoordinator.getStatus() });
});

app.get('/api/upgrades/:id', (req, res) => {
  const status = upgradeCoordinator.getProgress(req.params.id);
  if (!status) {
    return res.status(404).json({ success: false, error: 'Upgrade not found' });
  }
  res.json({ success: true, data: status });
});

app.post('/api/upgrades/:id/rollback', async (req, res) => {
  try {
    const result = await upgradeCoordinator.rollbackUpgrade(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Start the server using a try/catch boot wrapper
try {
  // 1. Run environment and diagnostic checks
  validateEnvironment();

  // 2. Start upgradeManager job and other services
  console.log('[Boot Diagnostics] Starting background services...');
  upgradeManager.start();

  // 3. Listen on port
  app.listen(PORT, () => {
    console.log(`GateDelay backend running on port ${PORT}`);
  });
} catch (error) {
  console.error('============================================================');
  console.error('  FATAL BOOT ERROR DETECTED');
  console.error(`  Reason: ${error.message}`);
  console.error('  Terminating Express server process gracefully.');
  console.error('============================================================');
  process.exit(1);
}

module.exports = app;
