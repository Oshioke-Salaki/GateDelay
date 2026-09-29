const moment = require('moment-timezone');

const marketTimeZones = {
  'NYSE': 'America/New_York',
  'NASDAQ': 'America/New_York',
  'LSE': 'Europe/London',
  'TSE': 'Asia/Tokyo',
  'HKEX': 'Asia/Hong_Kong',
  'SGX': 'Asia/Singapore',
  'ASX': 'Australia/Sydney',
  'FSE': 'Europe/Berlin'
};

function convertTime(date, fromZone, toZone) {
  return moment.tz(date, fromZone).tz(toZone).format();
}

function getCurrentTimeInZone(timeZone) {
  return moment.tz(timeZone).format();
}

function isDSTActive(timeZone) {
  return moment.tz(timeZone).isDST();
}

function getMarketTimeZone(market) {
  return marketTimeZones[market] || 'UTC';
}

function formatTime(date, format = 'YYYY-MM-DD HH:mm:ss', timeZone = 'UTC') {
  return moment.tz(date, timeZone).format(format);
}

function parseTime(dateString, timeZone = 'UTC') {
  return moment.tz(dateString, timeZone).toDate();
}

function getTimeDifference(date1, date2, unit = 'minutes') {
  return moment(date1).diff(moment(date2), unit);
}

module.exports = {
  convertTime,
  getCurrentTimeInZone,
  isDSTActive,
  getMarketTimeZone,
  formatTime,
  parseTime,
  getTimeDifference
};
