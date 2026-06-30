/**
 * On-Call Management API Routes
 *
 * Provides endpoints for schedule management, escalation policies,
 * on-call status, notifications, and history.
 */

const express = require('express');
const { oncallService } = require('../services/oncallService');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════
// Schedule Management
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/oncall/schedules
 * Create a new on-call schedule
 * Body: { name, marketId, oncallUser, startTime?, endTime?, cronExpr? }
 */
router.post('/schedules', async (req, res) => {
  try {
    const { name, marketId, oncallUser } = req.body;
    if (!name || !marketId || !oncallUser) {
      return res.status(400).json({ error: 'name, marketId, and oncallUser are required' });
    }
    const schedule = oncallService.createSchedule(req.body);
    res.status(201).json({ success: true, schedule });
  } catch (error) {
    console.error('Failed to create schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

/**
 * GET /api/oncall/schedules
 * List all schedules, optionally filtered by ?marketId=
 */
router.get('/schedules', async (req, res) => {
  try {
    const schedules = oncallService.listSchedules(req.query.marketId);
    res.json({ success: true, schedules });
  } catch (error) {
    console.error('Failed to list schedules:', error);
    res.status(500).json({ error: 'Failed to list schedules' });
  }
});

/**
 * GET /api/oncall/schedules/:id
 * Get a single schedule by ID
 */
router.get('/schedules/:id', async (req, res) => {
  try {
    const schedule = oncallService.getSchedule(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Failed to get schedule:', error);
    res.status(500).json({ error: 'Failed to get schedule' });
  }
});

/**
 * PATCH /api/oncall/schedules/:id
 * Update a schedule
 */
router.patch('/schedules/:id', async (req, res) => {
  try {
    const schedule = oncallService.updateSchedule(req.params.id, req.body);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true, schedule });
  } catch (error) {
    console.error('Failed to update schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

/**
 * DELETE /api/oncall/schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', async (req, res) => {
  try {
    const deleted = oncallService.deleteSchedule(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    console.error('Failed to delete schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

/**
 * POST /api/oncall/schedules/:id/start
 * Activate the cron job for a schedule
 */
router.post('/schedules/:id/start', async (req, res) => {
  try {
    const schedule = oncallService.startScheduleJob(req.params.id);
    res.json({ success: true, message: 'Schedule job started', schedule });
  } catch (error) {
    console.error('Failed to start schedule job:', error);
    res.status(500).json({ error: error.message || 'Failed to start schedule job' });
  }
});

/**
 * POST /api/oncall/schedules/:id/stop
 * Stop the cron job for a schedule
 */
router.post('/schedules/:id/stop', async (req, res) => {
  try {
    const schedule = oncallService.stopScheduleJob(req.params.id);
    res.json({ success: true, message: 'Schedule job stopped', schedule });
  } catch (error) {
    console.error('Failed to stop schedule job:', error);
    res.status(500).json({ error: 'Failed to stop schedule job' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Escalation Policies
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/oncall/policies
 * Create an escalation policy
 * Body: { name, marketId, levels: [{ priority, contact, delayMinutes }] }
 */
router.post('/policies', async (req, res) => {
  try {
    const { name, marketId, levels } = req.body;
    if (!name || !marketId) {
      return res.status(400).json({ error: 'name and marketId are required' });
    }
    const policy = oncallService.createPolicy({ name, marketId, levels });
    res.status(201).json({ success: true, policy });
  } catch (error) {
    console.error('Failed to create policy:', error);
    res.status(500).json({ error: 'Failed to create policy' });
  }
});

/**
 * GET /api/oncall/policies
 * List all policies, optionally filtered by ?marketId=
 */
router.get('/policies', async (req, res) => {
  try {
    const policies = oncallService.listPolicies(req.query.marketId);
    res.json({ success: true, policies });
  } catch (error) {
    console.error('Failed to list policies:', error);
    res.status(500).json({ error: 'Failed to list policies' });
  }
});

/**
 * GET /api/oncall/policies/:id
 * Get a single policy
 */
router.get('/policies/:id', async (req, res) => {
  try {
    const policy = oncallService.getPolicy(req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json({ success: true, policy });
  } catch (error) {
    console.error('Failed to get policy:', error);
    res.status(500).json({ error: 'Failed to get policy' });
  }
});

/**
 * PATCH /api/oncall/policies/:id
 * Update a policy
 */
router.patch('/policies/:id', async (req, res) => {
  try {
    const policy = oncallService.updatePolicy(req.params.id, req.body);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json({ success: true, policy });
  } catch (error) {
    console.error('Failed to update policy:', error);
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

/**
 * DELETE /api/oncall/policies/:id
 * Delete a policy
 */
router.delete('/policies/:id', async (req, res) => {
  try {
    const deleted = oncallService.deletePolicy(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Policy not found' });
    res.json({ success: true, message: 'Policy deleted' });
  } catch (error) {
    console.error('Failed to delete policy:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

/**
 * POST /api/oncall/policies/:id/escalate
 * Trigger escalation for an incident
 * Body: { incidentDetails: string }
 */
router.post('/policies/:id/escalate', async (req, res) => {
  try {
    const { incidentDetails } = req.body;
    if (!incidentDetails) {
      return res.status(400).json({ error: 'incidentDetails is required' });
    }
    const results = await oncallService.triggerEscalation(req.params.id, incidentDetails);
    res.json({ success: true, escalation: results });
  } catch (error) {
    console.error('Failed to trigger escalation:', error);
    res.status(500).json({ error: error.message || 'Failed to trigger escalation' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// On-Call Status
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/oncall/status
 * Get current on-call status
 * Query: ?marketId=
 */
router.get('/status', async (req, res) => {
  try {
    const { marketId } = req.query;
    if (!marketId) return res.status(400).json({ error: 'marketId query param is required' });
    const status = oncallService.getOncallStatus(marketId);
    res.json({ success: true, status });
  } catch (error) {
    console.error('Failed to get on-call status:', error);
    res.status(500).json({ error: 'Failed to get on-call status' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/oncall/notify
 * Send a manual on-call notification
 * Body: { to, message, scheduleId? }
 */
router.post('/notify', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'to and message are required' });
    }
    const result = await oncallService.sendOncallNotification(req.body);
    res.json({ success: true, notification: result });
  } catch (error) {
    console.error('Failed to send notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// History
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/oncall/history
 * Get on-call event history
 * Query: ?marketId=&type=&limit=
 */
router.get('/history', async (req, res) => {
  try {
    const { marketId, type, limit } = req.query;
    const entries = oncallService.getHistory({ marketId, type, limit });
    res.json({ success: true, count: entries.length, history: entries });
  } catch (error) {
    console.error('Failed to get history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

module.exports = router;