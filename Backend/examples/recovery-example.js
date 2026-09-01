/**
 * DISASTER RECOVERY API EXAMPLES
 * Demonstrates how to use the disaster recovery system
 */

const recoveryService = require('../services/recoveryService');

/**
 * Example 1: Trigger manual recovery
 */
async function example1_manualRecovery() {
  console.log('=== Example 1: Manual Recovery Trigger ===\n');
  
  const job = await recoveryService.createRecoveryJob({
    type: 'DATABASE',
    triggerType: recoveryService.TRIGGER_TYPES.MANUAL,
    description: 'Manual database recovery',
    backupId: 'backup-1',
  });
  
  console.log(`Recovery Job Created: ${job.id}`);
  console.log(`  Type: ${job.type}`);
  console.log(`  Status: ${job.status}`);
  console.log(`  Created: ${job.createdAt}`);
}

/**
 * Example 2: Schedule future recovery
 */
async function example2_scheduleRecovery() {
  console.log('\n=== Example 2: Schedule Future Recovery ===\n');
  
  const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  const job = await recoveryService.createRecoveryJob({
    type: 'APPLICATION',
    triggerType: recoveryService.TRIGGER_TYPES.SCHEDULED,
    scheduledTime: futureTime,
    description: 'Scheduled application recovery for maintenance',
    backupId: 'backup-2',
  });
  
  console.log(`Scheduled Recovery Created: ${job.id}`);
  console.log(`  Type: ${job.type}`);
  console.log(`  Scheduled Time: ${job.scheduledTime}`);
  console.log(`  Status: ${job.status}`);
}

/**
 * Example 3: Execute recovery job
 */
async function example3_executeRecovery() {
  console.log('\n=== Example 3: Execute Recovery Job ===\n');
  
  try {
    // Create job
    const job = await recoveryService.createRecoveryJob({
      type: 'DATABASE',
      description: 'Test recovery execution',
      backupId: 'backup-1',
    });
    
    console.log(`Created job: ${job.id}`);
    console.log(`Initial status: ${job.status}\n`);
    
    // Execute recovery
    console.log('Starting recovery execution...');
    const result = await recoveryService.executeRecoveryJob(job.id);
    
    console.log(`\nRecovery completed!`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Duration: ${result.completedAt ? new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime() : 'N/A'}ms`);
    console.log(`  Steps completed: ${result.steps.length}`);
  } catch (error) {
    console.log(`Recovery failed: ${error.message}`);
  }
}

/**
 * Example 4: Check recovery status
 */
async function example4_checkStatus() {
  console.log('\n=== Example 4: Check Recovery Status ===\n');
  
  // Create a job first
  const job = await recoveryService.createRecoveryJob({
    type: 'INFRASTRUCTURE',
    description: 'Infrastructure recovery check',
  });
  
  // Get status
  const status = await recoveryService.getRecoveryJob(job.id);
  
  console.log(`Recovery Job Status:`);
  console.log(`  ID: ${status.id}`);
  console.log(`  Type: ${status.type}`);
  console.log(`  Status: ${status.status}`);
  console.log(`  Progress: ${status.progress}%`);
  console.log(`  Created: ${status.createdAt}`);
}

/**
 * Example 5: List all recovery jobs
 */
async function example5_listJobs() {
  console.log('\n=== Example 5: List Recovery Jobs ===\n');
  
  // Create some jobs
  for (let i = 0; i < 3; i++) {
    await recoveryService.createRecoveryJob({
      type: i % 2 === 0 ? 'DATABASE' : 'APPLICATION',
      description: `Recovery job ${i + 1}`,
    });
  }
  
  // List all jobs
  const allJobs = await recoveryService.getRecoveryJobs();
  console.log(`Found ${allJobs.length} recovery jobs:\n`);
  
  allJobs.forEach((job, index) => {
    console.log(`${index + 1}. ${job.id}`);
    console.log(`   Type: ${job.type}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Trigger: ${job.triggerType}`);
    console.log('');
  });
}

/**
 * Example 6: Filter recovery jobs
 */
async function example6_filterJobs() {
  console.log('\n=== Example 6: Filter Recovery Jobs ===\n');
  
  // Create jobs with different types
  const types = ['DATABASE', 'APPLICATION', 'INFRASTRUCTURE'];
  for (const type of types) {
    await recoveryService.createRecoveryJob({
      type,
      description: `${type} recovery`,
    });
  }
  
  // Filter by type
  const dbJobs = await recoveryService.getRecoveryJobs({ type: 'DATABASE' });
  console.log(`Database recovery jobs: ${dbJobs.length}`);
  
  const appJobs = await recoveryService.getRecoveryJobs({ type: 'APPLICATION' });
  console.log(`Application recovery jobs: ${appJobs.length}`);
}

/**
 * Example 7: Recovery statistics
 */
async function example7_statistics() {
  console.log('\n=== Example 7: Recovery Statistics ===\n');
  
  const stats = await recoveryService.getRecoveryStats();
  
  console.log('Recovery Statistics:');
  console.log(`  Total Jobs: ${stats.totalJobs}`);
  console.log(`  Completed: ${stats.byStatus.COMPLETED}`);
  console.log(`  Failed: ${stats.byStatus.FAILED}`);
  console.log(`  In Progress: ${stats.byStatus.IN_PROGRESS}`);
  console.log(`  Scheduled: ${stats.byStatus.SCHEDULED}`);
  console.log(`  Success Rate: ${stats.successRate}`);
  console.log(`  Average Duration: ${stats.averageDuration}`);
}

/**
 * Example 8: Validate recovery execution
 */
async function example8_validateRecovery() {
  console.log('\n=== Example 8: Validate Recovery Execution ===\n');
  
  const job = await recoveryService.createRecoveryJob({
    type: 'DATABASE',
    backupId: 'backup-invalid',
  });
  
  console.log(`Validating recovery job: ${job.id}\n`);
  
  try {
    const validation = await recoveryService.validateRecoveryExecution(job.id);
    
    console.log(`Can Execute: ${validation.canExecute}`);
    if (validation.issues.length > 0) {
      console.log('Issues found:');
      validation.issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    } else {
      console.log('No issues - ready for execution');
    }
  } catch (error) {
    console.log(`Validation error: ${error.message}`);
  }
}

/**
 * Example 9: Recovery timeline
 */
async function example9_timeline() {
  console.log('\n=== Example 9: Recovery Timeline ===\n');
  
  // Create and execute recovery
  const job = await recoveryService.createRecoveryJob({
    type: 'DATABASE',
    description: 'Timeline test',
    backupId: 'backup-1',
  });
  
  try {
    await recoveryService.executeRecoveryJob(job.id);
  } catch (error) {
    console.log(`Execution note: ${error.message}`);
  }
  
  // Get timeline
  const timeline = await recoveryService.getRecoveryTimeline(job.id);
  
  console.log(`Recovery Timeline for ${timeline.jobId}:`);
  console.log(`  Status: ${timeline.status}`);
  console.log(`  Started: ${timeline.startedAt}`);
  console.log(`  Completed: ${timeline.completedAt}`);
  console.log(`\n  Execution Steps:`);
  
  timeline.steps.forEach((step, index) => {
    if (step.step) {
      console.log(`\n  ${index + 1}. ${step.step}`);
      console.log(`     Status: ${step.status}`);
      console.log(`     Time: ${step.timestamp}`);
      
      if (step.substeps && step.substeps.length > 0) {
        console.log(`     Substeps:`);
        step.substeps.forEach(substep => {
          console.log(`       - ${substep.message}`);
        });
      }
    }
  });
}

/**
 * Example 10: Cancel scheduled recovery
 */
async function example10_cancelRecovery() {
  console.log('\n=== Example 10: Cancel Scheduled Recovery ===\n');
  
  // Schedule recovery
  const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const job = await recoveryService.createRecoveryJob({
    type: 'APPLICATION',
    scheduledTime: futureTime,
    description: 'Recovery to be cancelled',
  });
  
  console.log(`Scheduled recovery: ${job.id}`);
  console.log(`Status before cancel: ${job.status}`);
  
  // Cancel it
  const cancelled = await recoveryService.cancelRecoveryJob(job.id);
  
  console.log(`Status after cancel: ${cancelled.status}`);
  console.log(`Cancelled at: ${cancelled.cancelledAt}`);
}

/**
 * Example 11: Automated recovery trigger
 */
async function example11_automatedRecovery() {
  console.log('\n=== Example 11: Automated Recovery Trigger ===\n');
  
  // System detects issue and triggers automated recovery
  const job = await recoveryService.triggerAutomatedRecovery(
    'DATABASE',
    'Data corruption detected in primary database'
  );
  
  console.log(`Automated recovery triggered: ${job.id}`);
  console.log(`  Type: ${job.type}`);
  console.log(`  Trigger Type: ${job.triggerType}`);
  console.log(`  Description: ${job.description}`);
}

/**
 * Example 12: Recovery reports
 */
async function example12_recoveryReports() {
  console.log('\n=== Example 12: Recovery Reports ===\n');
  
  // Create and execute recovery
  const job = await recoveryService.createRecoveryJob({
    type: 'DATABASE',
    description: 'Report generation test',
  });
  
  try {
    await recoveryService.executeRecoveryJob(job.id);
  } catch (error) {
    // Expected for test
  }
  
  // Get reports
  const reports = await recoveryService.getRecoveryReports();
  
  console.log(`Generated ${reports.length} recovery reports:\n`);
  
  reports.forEach(report => {
    console.log(`Report: ${report.id}`);
    console.log(`  Job: ${report.jobId}`);
    console.log(`  Status: ${report.status}`);
    console.log(`  Duration: ${report.duration}ms`);
    if (report.summary) {
      console.log(`  Success Rate: ${report.summary.successRate}`);
    }
    if (report.metrics) {
      console.log(`  RTO: ${report.metrics.recoveryTimeObjective}`);
      console.log(`  RPO: ${report.metrics.recoveryPointObjective}`);
    }
    console.log('');
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 DISASTER RECOVERY API EXAMPLES\n');
  console.log('================================================\n');
  
  try {
    await example1_manualRecovery();
    await example2_scheduleRecovery();
    await example3_executeRecovery();
    await example4_checkStatus();
    await example5_listJobs();
    await example6_filterJobs();
    await example7_statistics();
    await example8_validateRecovery();
    await example9_timeline();
    await example10_cancelRecovery();
    await example11_automatedRecovery();
    await example12_recoveryReports();
    
    console.log('\n================================================');
    console.log('✅ All examples completed');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  example1_manualRecovery,
  example2_scheduleRecovery,
  example3_executeRecovery,
  example4_checkStatus,
  example5_listJobs,
  example6_filterJobs,
  example7_statistics,
  example8_validateRecovery,
  example9_timeline,
  example10_cancelRecovery,
  example11_automatedRecovery,
  example12_recoveryReports,
};
