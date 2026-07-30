/**
 * BACKUP JOB
 * Scheduled job for automated backups with retention policy enforcement.
 */

const backupService = require('../services/backupService');

// Track backup schedules
const backupSchedules = new Map();
let scheduleIdCounter = 1;

/**
 * Initialize backup scheduler
 */
function initializeBackupScheduler(scheduleConfigs = []) {
  console.log('Initializing backup scheduler');
  
  // Default schedules if none provided
  const defaultSchedules = [
    {
      name: 'Daily Full Backup',
      type: 'FULL',
      description: 'Daily full backup at 2 AM',
      frequency: 'daily',
      time: '02:00',
      retentionDays: 30,
    },
    {
      name: 'Hourly Incremental Backup',
      type: 'INCREMENTAL',
      description: 'Hourly incremental backup',
      frequency: 'hourly',
      retentionDays: 7,
    },
  ];

  const configs = scheduleConfigs.length > 0 ? scheduleConfigs : defaultSchedules;

  configs.forEach(config => {
    scheduleBackup(config);
  });

  return Array.from(backupSchedules.values());
}

/**
 * Schedule a backup job
 */
function scheduleBackup(config) {
  const {
    name,
    type,
    description = '',
    frequency,
    time = null,
    retentionDays = 30,
  } = config;

  const schedule = {
    id: `schedule-${scheduleIdCounter++}`,
    name,
    type,
    description,
    frequency,
    time,
    retentionDays,
    enabled: true,
    createdAt: new Date().toISOString(),
    nextRun: calculateNextRun(frequency, time),
    lastRun: null,
    lastRunStatus: null,
  };

  backupSchedules.set(schedule.id, schedule);
  setupScheduleInterval(schedule);

  console.log(`Scheduled backup: ${name} (${frequency})`);
  return schedule;
}

/**
 * Calculate next run time
 */
function calculateNextRun(frequency, time) {
  const now = new Date();
  let nextRun = new Date(now);

  if (frequency === 'hourly') {
    nextRun.setHours(nextRun.getHours() + 1);
    nextRun.setMinutes(0);
    nextRun.setSeconds(0);
  } else if (frequency === 'daily') {
    const [hours, minutes] = (time || '02:00').split(':');
    nextRun.setDate(nextRun.getDate() + 1);
    nextRun.setHours(parseInt(hours));
    nextRun.setMinutes(parseInt(minutes));
    nextRun.setSeconds(0);

    // If today's scheduled time hasn't passed yet, schedule for today
    const todaySchedule = new Date(now);
    todaySchedule.setHours(parseInt(hours));
    todaySchedule.setMinutes(parseInt(minutes));
    todaySchedule.setSeconds(0);

    if (todaySchedule > now) {
      nextRun = todaySchedule;
    }
  } else if (frequency === 'weekly') {
    nextRun.setDate(nextRun.getDate() + (7 - nextRun.getDay()));
    nextRun.setHours(2);
    nextRun.setMinutes(0);
    nextRun.setSeconds(0);
  }

  return nextRun.toISOString();
}

/**
 * Setup interval for backup schedule
 */
function setupScheduleInterval(schedule) {
  const checkInterval = setInterval(async () => {
    if (!schedule.enabled) {
      return;
    }

    const now = new Date();
    const nextRun = new Date(schedule.nextRun);

    if (now >= nextRun) {
      try {
        await executeScheduledBackup(schedule);
      } catch (error) {
        console.error(`Error executing scheduled backup ${schedule.id}:`, error.message);
        schedule.lastRunStatus = 'FAILED';
      }

      // Recalculate next run
      schedule.nextRun = calculateNextRun(schedule.frequency, schedule.time);
    }
  }, 60000); // Check every minute

  // Store interval reference for cleanup
  if (!backupSchedules.has(`interval-${schedule.id}`)) {
    backupSchedules.set(`interval-${schedule.id}`, checkInterval);
  }

  return checkInterval;
}

/**
 * Execute scheduled backup
 */
async function executeScheduledBackup(schedule) {
  console.log(`Executing scheduled backup: ${schedule.name}`);

  try {
    // Create backup job
    const backup = await backupService.createBackup({
      type: schedule.type,
      description: `Scheduled backup: ${schedule.name}`,
      retentionDays: schedule.retentionDays,
      source: [], // Populated by actual implementation
    });

    // Execute backup
    await backupService.executeBackup(backup.id);

    schedule.lastRun = new Date().toISOString();
    schedule.lastRunStatus = 'COMPLETED';

    console.log(`Backup completed: ${backup.id}`);
  } catch (error) {
    schedule.lastRun = new Date().toISOString();
    schedule.lastRunStatus = 'FAILED';
    console.error(`Scheduled backup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Cleanup and remove a schedule
 */
function removeSchedule(scheduleId) {
  const schedule = backupSchedules.get(scheduleId);

  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }

  // Clear interval
  const intervalKey = `interval-${scheduleId}`;
  const interval = backupSchedules.get(intervalKey);
  if (interval) {
    clearInterval(interval);
    backupSchedules.delete(intervalKey);
  }

  backupSchedules.delete(scheduleId);
  console.log(`Removed schedule: ${scheduleId}`);

  return { success: true, scheduleId };
}

/**
 * Update schedule configuration
 */
function updateSchedule(scheduleId, updates) {
  const schedule = backupSchedules.get(scheduleId);

  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }

  const allowedUpdates = ['enabled', 'time', 'retentionDays'];
  
  for (const key of allowedUpdates) {
    if (key in updates) {
      if (key === 'time') {
        schedule.nextRun = calculateNextRun(schedule.frequency, updates[key]);
      }
      schedule[key] = updates[key];
    }
  }

  return schedule;
}

/**
 * Get all backup schedules
 */
function getSchedules() {
  const schedules = [];
  for (const [key, value] of backupSchedules.entries()) {
    if (!key.startsWith('interval-')) {
      schedules.push(value);
    }
  }
  return schedules;
}

/**
 * Get a specific schedule
 */
function getSchedule(scheduleId) {
  return backupSchedules.get(scheduleId) || null;
}

/**
 * Run retention policy cleanup
 */
async function runRetentionPolicy() {
  console.log('Running backup retention policy cleanup');

  try {
    const result = await backupService.applyRetentionPolicy();
    console.log(`Retention policy cleanup completed: ${result.deletedCount} backups deleted`);
    
    // Log retention results
    if (result.deletedBackups.length > 0) {
      console.log(`Deleted backups: ${result.deletedBackups.join(', ')}`);
    }
    
    return result;
  } catch (error) {
    console.error('Error running retention policy:', error.message);
    throw error;
  }
}

/**
 * Shutdown backup scheduler
 */
function shutdown() {
  console.log('Shutting down backup scheduler');

  for (const [key, value] of backupSchedules.entries()) {
    if (key.startsWith('interval-')) {
      clearInterval(value);
    }
  }

  backupSchedules.clear();
}

/**
 * Get backup status summary
 */
function getBackupStatusSummary() {
  const schedules = getSchedules();
  const summaries = schedules.map(schedule => ({
    id: schedule.id,
    name: schedule.name,
    type: schedule.type,
    frequency: schedule.frequency,
    enabled: schedule.enabled,
    nextRun: schedule.nextRun,
    lastRun: schedule.lastRun,
    lastRunStatus: schedule.lastRunStatus,
  }));
  
  return {
    totalSchedules: summaries.length,
    activeSchedules: summaries.filter(s => s.enabled).length,
    schedules: summaries,
    summary: `${summaries.filter(s => s.enabled).length}/${summaries.length} schedules active`,
  };
}

/**
 * Pause/resume a schedule
 */
function toggleSchedule(scheduleId) {
  const schedule = backupSchedules.get(scheduleId);
  
  if (!schedule) {
    throw new Error(`Schedule ${scheduleId} not found`);
  }
  
  schedule.enabled = !schedule.enabled;
  console.log(`Schedule ${scheduleId} is now ${schedule.enabled ? 'enabled' : 'disabled'}`);
  
  return schedule;
}

module.exports = {
  initializeBackupScheduler,
  scheduleBackup,
  executeScheduledBackup,
  removeSchedule,
  updateSchedule,
  getSchedules,
  getSchedule,
  runRetentionPolicy,
  shutdown,
  getBackupStatusSummary,
  toggleSchedule,
};