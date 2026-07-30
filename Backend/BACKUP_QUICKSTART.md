# Backup System - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies

```bash
cd Backend
npm install
```

This installs:
- `aws-sdk` - AWS S3 integration
- `archiver` - File compression
- `extract-zip` - Restoration support

### 2. Configure Environment

Create `Backend/.env`:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_BACKUP_BUCKET=your-bucket
BACKUP_TEMP_DIR=/tmp/backups
DATA_DIR=./data
```

### 3. Initialize Scheduler

In your server startup code:

```javascript
const backupJob = require('./jobs/backupJob');

// Initialize with default schedules (daily + hourly)
const schedules = backupJob.initializeBackupScheduler();
console.log(`Started ${schedules.length} backup schedules`);
```

### 4. Add API Routes

```javascript
const express = require('express');
const backupService = require('./services/backupService');

const app = express();

// List all backups
app.get('/api/backups', async (req, res) => {
  const backups = await backupService.getBackups();
  res.json(backups);
});

// Create manual backup
app.post('/api/backups', async (req, res) => {
  const backup = await backupService.createBackup(req.body);
  const result = await backupService.executeBackup(backup.id);
  res.json(result);
});

// Get statistics
app.get('/api/backup-stats', async (req, res) => {
  const stats = await backupService.getBackupStats();
  res.json(stats);
});

// Restore from backup
app.post('/api/backups/:id/restore', async (req, res) => {
  const restore = await backupService.restoreFromBackup(
    req.params.id,
    req.body.restorePath
  );
  res.json(restore);
});
```

### 5. Run Examples

```bash
node Backend/examples/backup-example.js
```

## Common Tasks

### Manual Backup

```javascript
const backupService = require('./services/backupService');

const backup = await backupService.createBackup({
  type: 'FULL',
  description: 'Manual backup',
  retentionDays: 30,
  source: ['./data']
});

await backupService.executeBackup(backup.id);
```

### Check Status

```javascript
// View all backups
const backups = await backupService.getBackups();

// View statistics
const stats = await backupService.getBackupStats();
console.log(`${stats.totalBackups} total backups`);
console.log(`${stats.byStatus.VERIFIED} successful`);

// View schedules
const schedules = backupJob.getBackupStatusSummary();
console.log(`${schedules.activeSchedules} active schedules`);
```

### Restore Data

```javascript
// Find recent backup
const backups = await backupService.getBackups({ status: 'VERIFIED' });

// Restore
const restore = await backupService.restoreFromBackup(
  backups[0].id,
  './restored-data'
);
```

### View Reports

```javascript
// Get completed backups
const reports = await backupService.getBackupReports({ status: 'COMPLETED' });

reports.forEach(r => {
  console.log(`${r.backupId}: ${r.duration}ms, ${r.size} bytes`);
});
```

### Pause Backup

```javascript
// Get all schedules
const schedules = backupJob.getSchedules();

// Pause first schedule
backupJob.toggleSchedule(schedules[0].id);
```

### Cleanup Expired

```javascript
// Run retention policy immediately
const result = await backupJob.runRetentionPolicy();
console.log(`Deleted ${result.deletedCount} expired backups`);
```

## Default Schedules

| Schedule | Type | Frequency | Retention | Purpose |
|----------|------|-----------|-----------|---------|
| Daily Full Backup | FULL | Daily @ 2 AM | 30 days | Full database/file backup |
| Hourly Incremental | INCREMENTAL | Every hour | 7 days | Quick hourly changes |

## Monitoring

### Health Check

```javascript
const status = backupJob.getBackupStatusSummary();
if (status.activeSchedules === 0) {
  console.warn('No active backup schedules!');
}
```

### Failed Backups

```javascript
const failed = await backupService.getBackups({ status: 'FAILED' });
if (failed.length > 0) {
  console.error(`${failed.length} backups failed`);
  failed.forEach(b => console.log(b.error));
}
```

### Storage Usage

```javascript
const stats = await backupService.getBackupStats();
console.log(`Total storage: ${stats.totalSize}`);
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| S3 upload fails | Check AWS credentials and bucket permissions |
| No backups running | Verify scheduler initialized: `backupJob.initializeBackupScheduler()` |
| High storage use | Reduce retention days or enable incremental backups |
| Slow backups | Reduce compression level or backup smaller data sets |

## Next Steps

- See [BACKUP_SYSTEM.md](./BACKUP_SYSTEM.md) for complete API reference
- Run [backup-example.js](./examples/backup-example.js) for detailed examples
- Set up monitoring/alerts for backup failures
- Configure custom retention policies based on your needs
- Enable S3 versioning for additional protection
