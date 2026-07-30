/**
 * BACKUP SYSTEM EXAMPLE
 * Demonstrates how to use the automated backup system
 */

const backupService = require('../services/backupService');
const backupJob = require('../jobs/backupJob');

/**
 * Example 1: Initialize backup scheduler with default schedules
 */
async function example1_initializeScheduler() {
  console.log('=== Example 1: Initialize Backup Scheduler ===\n');
  
  const schedules = backupJob.initializeBackupScheduler();
  
  console.log('Initialized schedules:');
  schedules.forEach(schedule => {
    console.log(`  - ${schedule.name} (${schedule.frequency}, retention: ${schedule.retentionDays} days)`);
  });
}

/**
 * Example 2: Create a custom backup schedule
 */
async function example2_customSchedule() {
  console.log('\n=== Example 2: Create Custom Backup Schedule ===\n');
  
  const customSchedule = backupJob.scheduleBackup({
    name: 'Weekly Database Backup',
    type: 'FULL',
    description: 'Complete database backup every Sunday',
    frequency: 'weekly',
    time: '23:00',
    retentionDays: 90,
  });
  
  console.log('Custom schedule created:');
  console.log(`  ID: ${customSchedule.id}`);
  console.log(`  Next Run: ${customSchedule.nextRun}`);
  console.log(`  Retention: ${customSchedule.retentionDays} days`);
}

/**
 * Example 3: Create and execute a backup manually
 */
async function example3_manualBackup() {
  console.log('\n=== Example 3: Manual Backup Execution ===\n');
  
  try {
    // Create backup
    const backup = await backupService.createBackup({
      type: 'FULL',
      description: 'Manual full backup for testing',
      retentionDays: 30,
      source: [process.env.DATA_DIR || './data'],
    });
    
    console.log(`Created backup: ${backup.id}`);
    console.log(`Status: ${backup.status}`);
    
    // Execute backup
    console.log('\nExecuting backup...');
    const result = await backupService.executeBackup(backup.id);
    
    console.log(`\nBackup completed!`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Size: ${result.size} bytes`);
    console.log(`  Location: ${result.location}`);
    console.log(`  Checksum: ${result.checksum.substring(0, 16)}...`);
  } catch (error) {
    console.error('Backup failed:', error.message);
  }
}

/**
 * Example 4: Get backup status and monitoring
 */
async function example4_backupStatus() {
  console.log('\n=== Example 4: Backup Status Monitoring ===\n');
  
  // Get backup statistics
  const stats = await backupService.getBackupStats();
  console.log('Backup Statistics:');
  console.log(`  Total Backups: ${stats.totalBackups}`);
  console.log(`  Verified: ${stats.byStatus.VERIFIED}`);
  console.log(`  Failed: ${stats.byStatus.FAILED}`);
  console.log(`  In Progress: ${stats.byStatus.IN_PROGRESS}`);
  console.log(`  Total Size: ${stats.totalSize}`);
  
  // Get schedule status
  const statusSummary = backupJob.getBackupStatusSummary();
  console.log('\nSchedule Status:');
  console.log(`  Active Schedules: ${statusSummary.activeSchedules}/${statusSummary.totalSchedules}`);
  statusSummary.schedules.forEach(schedule => {
    console.log(`    - ${schedule.name}: ${schedule.enabled ? 'enabled' : 'disabled'} (next: ${schedule.nextRun})`);
  });
}

/**
 * Example 5: View backup reports
 */
async function example5_backupReports() {
  console.log('\n=== Example 5: Backup Reports ===\n');
  
  const reports = await backupService.getBackupReports({ status: 'COMPLETED' });
  
  console.log(`Found ${reports.length} completed backup reports:\n`);
  
  reports.slice(0, 3).forEach(report => {
    console.log(`Report: ${report.id}`);
    console.log(`  Backup: ${report.backupId}`);
    console.log(`  Status: ${report.status}`);
    console.log(`  Duration: ${report.duration}ms`);
    console.log(`  Size: ${report.size} bytes`);
    console.log(`  Success Rate: ${report.summary.successRate}`);
    console.log(`  Expires: ${report.retention.expiresAt}`);
    console.log('');
  });
}

/**
 * Example 6: Restore from backup
 */
async function example6_restoreBackup() {
  console.log('\n=== Example 6: Restore from Backup ===\n');
  
  try {
    // Get a verified backup
    const backups = await backupService.getBackups({ status: 'VERIFIED' });
    
    if (backups.length === 0) {
      console.log('No verified backups available for restore');
      return;
    }
    
    const backupToRestore = backups[0];
    const restorePath = process.env.RESTORE_DIR || './restored-data';
    
    console.log(`Restoring from backup: ${backupToRestore.id}`);
    console.log(`Restore destination: ${restorePath}`);
    
    const result = await backupService.restoreFromBackup(backupToRestore.id, restorePath);
    
    console.log(`\nRestore completed!`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Location: ${restorePath}`);
    result.steps.forEach(step => {
      console.log(`  - ${step.step}: ${step.status}`);
    });
  } catch (error) {
    console.error('Restore failed:', error.message);
  }
}

/**
 * Example 7: Manage retention policy
 */
async function example7_retentionPolicy() {
  console.log('\n=== Example 7: Retention Policy Management ===\n');
  
  // Apply retention policy
  const result = await backupJob.runRetentionPolicy();
  
  console.log('Retention Policy Results:');
  console.log(`  Backups Deleted: ${result.deletedCount}`);
  console.log(`  Timestamp: ${result.timestamp}`);
  
  if (result.deletedBackups.length > 0) {
    console.log(`  Deleted IDs: ${result.deletedBackups.join(', ')}`);
  }
}

/**
 * Example 8: Update schedule configuration
 */
async function example8_updateSchedule() {
  console.log('\n=== Example 8: Update Schedule Configuration ===\n');
  
  const schedules = backupJob.getSchedules();
  
  if (schedules.length === 0) {
    console.log('No schedules available');
    return;
  }
  
  const schedule = schedules[0];
  
  console.log(`Original schedule: ${schedule.name}`);
  console.log(`  Time: ${schedule.time}`);
  console.log(`  Retention: ${schedule.retentionDays} days`);
  
  // Update schedule
  const updated = backupJob.updateSchedule(schedule.id, {
    time: '03:00',
    retentionDays: 60,
  });
  
  console.log(`\nUpdated schedule:`);
  console.log(`  Time: ${updated.time}`);
  console.log(`  Retention: ${updated.retentionDays} days`);
}

/**
 * Example 9: Pause and resume schedules
 */
async function example9_pauseResume() {
  console.log('\n=== Example 9: Pause/Resume Schedules ===\n');
  
  const schedules = backupJob.getSchedules();
  
  if (schedules.length === 0) {
    console.log('No schedules available');
    return;
  }
  
  const schedule = schedules[0];
  
  console.log(`Schedule: ${schedule.name}`);
  console.log(`  Current Status: ${schedule.enabled ? 'enabled' : 'disabled'}`);
  
  // Toggle schedule
  const toggled = backupJob.toggleSchedule(schedule.id);
  
  console.log(`  New Status: ${toggled.enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('📦 BACKUP SYSTEM EXAMPLES\n');
  console.log('================================================\n');
  
  try {
    await example1_initializeScheduler();
    await example2_customSchedule();
    // await example3_manualBackup();        // Requires proper S3 setup
    await example4_backupStatus();
    await example5_backupReports();
    // await example6_restoreBackup();       // Requires existing backup
    await example7_retentionPolicy();
    await example8_updateSchedule();
    await example9_pauseResume();
    
    console.log('\n================================================');
    console.log('✅ All examples completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  // Cleanup
  backupJob.shutdown();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  example1_initializeScheduler,
  example2_customSchedule,
  example3_manualBackup,
  example4_backupStatus,
  example5_backupReports,
  example6_restoreBackup,
  example7_retentionPolicy,
  example8_updateSchedule,
  example9_pauseResume,
};
