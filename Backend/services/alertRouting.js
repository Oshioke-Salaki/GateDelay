const Bull = require('bull');
const Redis = require('ioredis');

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

alertQueue.process(processAlert);

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
    priority: alert.priority === 'high' ? 1 : alert.priority === 'medium' ? 2 : 3
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
