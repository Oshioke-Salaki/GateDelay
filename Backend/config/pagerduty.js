const apiKey = process.env.PAGERDUTY_API_KEY || '';
const serviceId = process.env.PAGERDUTY_SERVICE_ID || '';
const fromEmail = process.env.PAGERDUTY_FROM_EMAIL || '';

const missing = [
  !apiKey && 'PAGERDUTY_API_KEY',
  !serviceId && 'PAGERDUTY_SERVICE_ID',
  !fromEmail && 'PAGERDUTY_FROM_EMAIL'
].filter(Boolean);

if (missing.length > 0) {
  // Non-fatal: PagerDuty alerting is optional (see Backend/.env.example). Without this
  // warning, a missing var only ever surfaced as an opaque 401/400 from the PagerDuty API
  // the first time services/pagerduty.js made a call.
  console.warn(
    `[pagerduty] Alerting is not fully configured — missing: ${missing.join(', ')}. ` +
    'services/pagerduty.js calls will fail until these are set.'
  );
}

module.exports = {
  apiKey,
  serviceId,
  fromEmail,
  apiUrl: 'https://api.pagerduty.com',
  isConfigured: () => missing.length === 0
};
