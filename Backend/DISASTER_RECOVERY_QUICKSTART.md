# Disaster Recovery API - Quick Start

## 3-Minute Setup

### 1. Mount Routes

In your server file (`server.js`):

```javascript
const disasterRecoveryRoutes = require('./routes/disasterRecovery');

app.use('/disaster-recovery', disasterRecoveryRoutes);
```

### 2. Make Requests

```bash
# Trigger manual recovery
curl -X POST http://localhost:3000/disaster-recovery/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DATABASE",
    "backupId": "backup-123",
    "description": "Emergency recovery"
  }'

# Check status
curl http://localhost:3000/disaster-recovery/status/recovery-1

# List all recoveries
curl http://localhost:3000/disaster-recovery/jobs

# View statistics
curl http://localhost:3000/disaster-recovery/stats
```

### 3. Run Examples

```bash
node Backend/examples/recovery-example.js
```

## API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/trigger` | Trigger recovery |
| POST | `/schedule` | Schedule recovery |
| GET | `/status/:jobId` | Get status |
| GET | `/jobs` | List jobs |
| GET | `/reports` | Get reports |
| POST | `/validate/:jobId` | Validate job |
| POST | `/jobs/:jobId/execute` | Execute job |
| DELETE | `/jobs/:jobId` | Cancel job |
| GET | `/stats` | Get statistics |

## Common Tasks

### Trigger Database Recovery

```bash
curl -X POST http://localhost:3000/disaster-recovery/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "type": "DATABASE",
    "backupId": "backup-latest",
    "description": "Database recovery"
  }'
```

### Schedule Recovery for Later

```bash
curl -X POST http://localhost:3000/disaster-recovery/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "type": "APPLICATION",
    "scheduledTime": "2024-01-20T15:00:00Z",
    "backupId": "backup-123"
  }'
```

### Monitor Progress

```bash
# Check status
curl http://localhost:3000/disaster-recovery/status/recovery-1

# Get timeline
curl http://localhost:3000/disaster-recovery/jobs/recovery-1/timeline

# View statistics
curl http://localhost:3000/disaster-recovery/stats
```

### View Reports

```bash
# Get all reports
curl http://localhost:3000/disaster-recovery/reports

# Get specific report
curl http://localhost:3000/disaster-recovery/reports/report-recovery-1

# Get reports for job
curl http://localhost:3000/disaster-recovery/reports?jobId=recovery-1
```

### Manage Scheduled Recoveries

```bash
# Execute pending recovery
curl -X POST http://localhost:3000/disaster-recovery/jobs/recovery-1/execute

# Cancel scheduled recovery
curl -X DELETE http://localhost:3000/disaster-recovery/jobs/recovery-1

# Validate before execution
curl -X POST http://localhost:3000/disaster-recovery/validate/recovery-1
```

## Recovery Types

- **DATABASE** - Database recovery
- **APPLICATION** - Application service recovery
- **INFRASTRUCTURE** - Server/network recovery
- **FULL_SYSTEM** - Complete system recovery

## Status Values

- **PENDING** - Waiting to execute
- **IN_PROGRESS** - Currently executing
- **COMPLETED** - Successfully finished
- **FAILED** - Execution failed
- **SCHEDULED** - Waiting for scheduled time
- **CANCELLED** - Cancelled by user

## Example Response

```json
{
  "success": true,
  "data": {
    "id": "recovery-1",
    "type": "DATABASE",
    "status": "IN_PROGRESS",
    "progress": 45,
    "triggerType": "MANUAL",
    "createdAt": "2024-01-15T10:00:00Z",
    "startedAt": "2024-01-15T10:00:00Z",
    "steps": [
      {
        "step": "VALIDATE_BACKUP",
        "status": "COMPLETED"
      },
      {
        "step": "PREPARE_ENVIRONMENT",
        "status": "COMPLETED"
      },
      {
        "step": "RESTORE_DATA",
        "status": "IN_PROGRESS"
      }
    ]
  }
}
```

## Integration with Backup System

Recovery automatically uses the backup system:

```javascript
const job = await recoveryService.createRecoveryJob({
  type: 'DATABASE',
  backupId: 'backup-123'  // Links to backup
});

// Recovery executes using backup restoration
await recoveryService.executeRecoveryJob(job.id);
```

## Next Steps

- See [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) for complete API reference
- Run examples: `node Backend/examples/recovery-example.js`
- Monitor with `/stats` endpoint
- Integrate with monitoring system
