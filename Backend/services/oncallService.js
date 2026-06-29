/**
 * On-Call Management Service
 *
 * Manages schedules, escalation policies, status tracking,
 * notifications, and history for market incident response.
 */

const cron = require('node-cron');

// ── In-memory stores (replace with DB models as needed) ─────────────────────
const schedules = new Map();   // scheduleId -> schedule object
const policies  = new Map();   // policyId  -> escalation policy object
const history   = [];          // flat log of all on-call events
let   activeJobs = new Map();  // scheduleId -> cron job

// ── Notification stub (wire Twilio here) ─────────────────────────────────────
async function sendNotification(to, message) {
  // TODO: replace with real Twilio call
  // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // await twilio.messages.create({ body: message, from: process.env.TWILIO_FROM, to });
  console.log(`[NOTIFY] -> ${to}: ${message}`);
  return { to, message, sentAt: new Date().toISOString() };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function logHistory(type, payload) {
  const entry = { type, timestamp: new Date().toISOString(), ...payload };
  history.push(entry);
  return entry;
}

// ── Schedule management ──────────────────────────────────────────────────────
function createSchedule({ name, marketId, oncallUser, startTime, endTime, cronExpr }) {
  const id = generateId('sched');
  const schedule = {
    id,
    name,
    marketId,
    oncallUser,
    startTime: startTime || null,
    endTime:   endTime   || null,
    cronExpr:  cronExpr  || null,
    active: false,
    createdAt: new Date().toISOString(),
  };
  schedules.set(id, schedule);
  logHistory('schedule_created', { scheduleId: id, name, marketId });
  return schedule;
}

function getSchedule(id) {
  return schedules.get(id) || null;
}

function listSchedules(marketId) {
  const all = [...schedules.values()];
  return marketId ? all.filter(s => s.marketId === marketId) : all;
}

function updateSchedule(id, updates) {
  const schedule = schedules.get(id);
  if (!schedule) return null;
  Object.assign(schedule, updates, { updatedAt: new Date().toISOString() });
  logHistory('schedule_updated', { scheduleId: id, updates });
  return schedule;
}

function deleteSchedule(id) {
  stopScheduleJob(id);
  const deleted = schedules.delete(id);
  if (deleted) logHistory('schedule_deleted', { scheduleId: id });
  return deleted;
}

// ── Cron job lifecycle ────────────────────────────────────────────────────────
function startScheduleJob(scheduleId) {
  const schedule = schedules.get(scheduleId);
  if (!schedule) throw new Error(`Schedule ${scheduleId} not found`);
  if (!schedule.cronExpr) throw new Error('Schedule has no cronExpr');
  if (activeJobs.has(scheduleId)) return schedule; // already running

  const job = cron.schedule(schedule.cronExpr, async () => {
    console.log(`[ONCALL] Cron fired for schedule ${scheduleId}`);
    const note = await sendNotification(
      schedule.oncallUser,
      `On-call reminder: you are on duty for market ${schedule.marketId}`
    );
    logHistory('cron_notification_sent', { scheduleId, ...note });
  });

  activeJobs.set(scheduleId, job);
  schedule.active = true;
  logHistory('schedule_started', { scheduleId });
  return schedule;
}

function stopScheduleJob(scheduleId) {
  const job = activeJobs.get(scheduleId);
  if (job) {
    job.stop();
    activeJobs.delete(scheduleId);
  }
  const schedule = schedules.get(scheduleId);
  if (schedule) schedule.active = false;
  logHistory('schedule_stopped', { scheduleId });
  return schedule || null;
}

// ── Escalation policy management ─────────────────────────────────────────────
function createPolicy({ name, marketId, levels }) {
  // levels: [{ priority: 1, contact: 'user@x.com', delayMinutes: 0 }, ...]
  const id = generateId('policy');
  const policy = {
    id,
    name,
    marketId,
    levels: levels || [],
    createdAt: new Date().toISOString(),
  };
  policies.set(id, policy);
  logHistory('policy_created', { policyId: id, name });
  return policy;
}

function getPolicy(id) {
  return policies.get(id) || null;
}

function listPolicies(marketId) {
  const all = [...policies.values()];
  return marketId ? all.filter(p => p.marketId === marketId) : all;
}

function updatePolicy(id, updates) {
  const policy = policies.get(id);
  if (!policy) return null;
  Object.assign(policy, updates, { updatedAt: new Date().toISOString() });
  logHistory('policy_updated', { policyId: id });
  return policy;
}

function deletePolicy(id) {
  const deleted = policies.delete(id);
  if (deleted) logHistory('policy_deleted', { policyId: id });
  return deleted;
}

async function triggerEscalation(policyId, incidentDetails) {
  const policy = policies.get(policyId);
  if (!policy) throw new Error(`Policy ${policyId} not found`);

  const results = [];
  for (const level of policy.levels) {
    const note = await sendNotification(
      level.contact,
      `[ESCALATION L${level.priority}] Incident on market ${policy.marketId}: ${incidentDetails}`
    );
    results.push({ level: level.priority, ...note });
    logHistory('escalation_triggered', { policyId, level: level.priority, contact: level.contact });
  }
  return results;
}

// ── On-call status ────────────────────────────────────────────────────────────
function getOncallStatus(marketId) {
  const relevantSchedules = listSchedules(marketId);
  const now = new Date();
  const active = relevantSchedules.filter(s => {
    if (!s.active) return false;
    if (s.startTime && new Date(s.startTime) > now) return false;
    if (s.endTime   && new Date(s.endTime)   < now) return false;
    return true;
  });
  return {
    marketId,
    checkedAt: now.toISOString(),
    oncall: active.length > 0,
    activeSchedules: active,
  };
}

// ── Notification (manual) ─────────────────────────────────────────────────────
async function sendOncallNotification({ to, message, scheduleId }) {
  const result = await sendNotification(to, message);
  logHistory('manual_notification_sent', { scheduleId: scheduleId || null, ...result });
  return result;
}

// ── History ───────────────────────────────────────────────────────────────────
function getHistory({ marketId, type, limit } = {}) {
  let entries = [...history];
  if (type)     entries = entries.filter(e => e.type === type);
  if (marketId) entries = entries.filter(e => e.marketId === marketId);
  if (limit)    entries = entries.slice(-Number(limit));
  return entries.reverse(); // newest first
}

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  oncallService: {
    // Schedules
    createSchedule,
    getSchedule,
    listSchedules,
    updateSchedule,
    deleteSchedule,
    startScheduleJob,
    stopScheduleJob,
    // Policies
    createPolicy,
    getPolicy,
    listPolicies,
    updatePolicy,
    deletePolicy,
    triggerEscalation,
    // Status & notifications
    getOncallStatus,
    sendOncallNotification,
    // History
    getHistory,
  },
};