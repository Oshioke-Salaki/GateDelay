const cron = require('node-cron');
const timeUtils = require('../utils/timeUtils');

class TimeService {
  constructor() {
    this.scheduledJobs = new Map();
  }

  getMarketTime(market) {
    const timeZone = timeUtils.getMarketTimeZone(market);
    return {
      market,
      timeZone,
      currentTime: timeUtils.getCurrentTimeInZone(timeZone),
      isDST: timeUtils.isDSTActive(timeZone)
    };
  }

  convertMarketTime(market, date, targetTimeZone) {
    const sourceTimeZone = timeUtils.getMarketTimeZone(market);
    return {
      market,
      sourceTimeZone,
      targetTimeZone,
      convertedTime: timeUtils.convertTime(date, sourceTimeZone, targetTimeZone)
    };
  }

  scheduleJob(cronExpression, jobId, callback, timeZone = 'UTC') {
    if (this.scheduledJobs.has(jobId)) {
      this.cancelJob(jobId);
    }

    const job = cron.schedule(cronExpression, callback, {
      timezone: timeZone
    });

    this.scheduledJobs.set(jobId, job);
    return { jobId, status: 'scheduled', cronExpression, timeZone };
  }

  cancelJob(jobId) {
    const job = this.scheduledJobs.get(jobId);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(jobId);
      return { jobId, status: 'cancelled' };
    }
    return { jobId, status: 'not_found' };
  }

  listScheduledJobs() {
    return Array.from(this.scheduledJobs.keys()).map(jobId => ({
      jobId
    }));
  }

  queryTimeRange(startTime, endTime, timeZone = 'UTC') {
    const start = timeUtils.parseTime(startTime, timeZone);
    const end = timeUtils.parseTime(endTime, timeZone);
    const duration = timeUtils.getTimeDifference(end, start, 'minutes');

    return {
      timeZone,
      startTime: timeUtils.formatTime(start, 'YYYY-MM-DD HH:mm:ss', timeZone),
      endTime: timeUtils.formatTime(end, 'YYYY-MM-DD HH:mm:ss', timeZone),
      durationMinutes: duration
    };
  }
}

module.exports = new TimeService();
