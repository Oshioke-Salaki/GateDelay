const express = require('express');
const cors = require('cors');

const migrationRoutes = require('./routes/migration');
const rollbackRoutes = require('./routes/rollback');
const betaRoutes = require('./routes/beta');
const upgradeCoordinator = require('./services/upgradeCoordinator');
const upgradeManager = require('./jobs/upgradeManager');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/migrations', migrationRoutes);
app.use('/api/rollback', rollbackRoutes);
app.use('/api/beta', betaRoutes);

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

upgradeManager.start();

app.listen(PORT, () => {
  console.log(`GateDelay backend running on port ${PORT}`);
});

module.exports = app;
