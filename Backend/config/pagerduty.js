module.exports = {
  apiKey: process.env.PAGERDUTY_API_KEY || '',
  serviceId: process.env.PAGERDUTY_SERVICE_ID || '',
  fromEmail: process.env.PAGERDUTY_FROM_EMAIL || '',
  apiUrl: 'https://api.pagerduty.com'
};
