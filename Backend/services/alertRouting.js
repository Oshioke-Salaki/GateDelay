const Bull = require('bull');
const Redis = require('ioredis');
const { log } = require('../utils/correlation');
const { recordQueueFailure, withRetry } = require('./jobRetryService');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

const alertQueue = new Bull('alerts', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

const alertTemplates = {
  high_priority: '⚠️ HIGH PRIORITY: {{message}}',
  medium_priority: 'ℹ️ Medium Priority: {{message}}',
  low_priority: '🔔 Low Priority: {{message}}'
};

let alertHistory = [];
let activeAlerts = {};

function renderTemplate(templateKey, data) {
  const template = alertTemplates[templateKey] || alertTemplates.low_priority;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

function generateDedupeKey(alert) {
  return `${alert.type}-${alert.source}-${alert.message.substring(0, 50)}`;
}

function routeAlert(alert) {
  const channels = [];
  switch (alert.priority) {
    case 'high':
      channels.push('slack', 'email', 'sms');
      break;
    case 'medium':
      channels.push('slack', 'email');
      break;
    case 'low':
    default:
      channels.push('slack');
  }
  return channels;
}

async function sendAlertToChannel(alert, channel) {
  console.log(`Sending alert to ${channel}:`, alert);
  return { success: true, channel, timestamp: new Date().toISOString() };
}

async function processAlert(job) {
  const alert = job.data;
  const dedupeKey = generateDedupeKey(alert);

  if (activeAlerts[dedupeKey]) {
    console.log('Deduplicated alert:', dedupeKey);
    return { status: 'deduplicated' };
  }

  activeAlerts[dedupeKey] = true;
  setTimeout(() => {
    delete activeAlerts[dedupeKey];
  }, 5 * 60 * 1000);

  const channels = routeAlert(alert);
  const templateKey = `${alert.priority}_priority`;
  const renderedMessage = renderTemplate(templateKey, alert);

  const deliveryResults = [];
  for (const channel of channels) {
    const result = await sendAlertToChannel({ ...alert, renderedMessage }, channel);
    deliveryResults.push(result);
  }

  const historyEntry = {
    id: Date.now().toString(),
    ...alert,
    renderedMessage,
    channels,
    deliveryResults,
    timestamp: new Date().toISOString()
  };
  alertHistory.push(historyEntry);

  return { status: 'delivered', entry: historyEntry };
}

alertQueue.process((job) =>
  // A single channel failing used to fail the whole alert and lose the other
  // channels' deliveries with it. Bound the retries and, on the last one,
  // dead-letter the alert so an operator can re-send it (#913).
  withRetry(() => processAlert(job), {
    job: 'alert-delivery',
    queue: 'alerts',
    jobId: String(job.id),
    payload: job.data,
  }),
);

alertQueue.on('failed', (job, err) => {
  log('error', 'Alert delivery failed', {
    jobId: job.id,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts?.attempts,
    alertId: job.data?.id,
    error: err.message,
  });
  // Bull emits `failed` on every attempt; only the last one is terminal.
  recordQueueFailure(job, err, { queue: 'alerts', job: 'alert-delivery' });
});

async function createAlert(alertData) {
  const alert = {
    id: Date.now().toString(),
    type: alertData.type || 'general',
    source: alertData.source || 'system',
    message: alertData.message,
    priority: alertData.priority || 'low',
    metadata: alertData.metadata || {},
    timestamp: new Date().toISOString()
  };

  const job = await alertQueue.add(alert, {
    priority:
      alert.priority === 'high' ? 1 : alert.priority === 'medium' ? 2 : 3,
    // High-priority alerts get more attempts because dropping one is far more
    // costly than re-sending it.
    attempts: alert.priority === 'high' ? 5 : 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: 500,
    removeOnFail: false,
  });

  return { success: true, alert, jobId: job.id };
}

function getAlertHistory() {
  return alertHistory;
}

function getTemplates() {
  return alertTemplates;
}

module.exports = {
  createAlert,
  getAlertHistory,
  getTemplates
};
