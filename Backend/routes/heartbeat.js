const express = require('express');
const { HeartbeatService } = require('../services/heartbeat');
const monitor = require('../jobs/heartbeatMonitor');

const router = express.Router();

let _service = null;

function getService() {
  if (!_service) {
    _service = new HeartbeatService();
  }
  return _service;
}

function setService(service) {
  _service = service;
}

router.post('/beat', async (req, res) => {
  try {
    const { id, metadata } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const result = await getService().beat(id, metadata);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { id, metadata, expectedIntervalMs } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'id is required' });
    }
    const result = await getService().registerComponent(id, metadata, expectedIntervalMs);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/register/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const result = await getService().unregisterComponent(componentId);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    const statuses = await getService().getStatus();
    res.json({ success: true, count: statuses.length, data: statuses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const status = await getService().getComponentStatus(componentId);
    if (!status) {
      return res.status(404).json({ error: 'Component not found' });
    }
    res.json({ success: true, data: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [serviceStats, monitorStats] = await Promise.all([
      getService().getStats(),
      monitor.getStats(),
    ]);
    res.json({ success: true, data: { service: serviceStats, monitor: monitorStats } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/monitor/start', async (req, res) => {
  try {
    const { interval } = req.body;
    const result = monitor.startMonitoring(getService(), interval);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/monitor/stop', async (req, res) => {
  try {
    const result = monitor.stopMonitoring();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, setService, getService };
