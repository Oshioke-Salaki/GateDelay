# Trade Report Service - Setup Guide

## Installation

### 1. Install Required Dependencies

The trade report service requires `exceljs` which is not currently in the package.json:

```bash
cd Backend
npm install exceljs
```

All other dependencies (mongoose, big.js, uuid, json2csv) are already installed.

### 2. Create Reports Directory

The service stores generated reports temporarily:

```bash
mkdir -p Backend/temp/reports
```

Or the service will create it automatically on first run.

### 3. Integrate with Server

Add the following to your main server file (e.g., `Backend/src/main.ts` or `Backend/server.js`):

```javascript
const express = require('express');
const path = require('path');
const tradeReportsRouter = require('./routes/tradeReports');

const app = express();

// ... other middleware

// Mount trade reports routes
app.use('/api/trade-reports', tradeReportsRouter);

// Serve static report files
app.use('/reports', express.static(path.join(__dirname, 'temp', 'reports')));

// ... rest of server setup
```

### 4. Set Up Automatic Cleanup (Optional but Recommended)

Add a scheduled job to clean up expired reports:

```javascript
const cron = require('node-cron');
const tradeReportService = require('./services/tradeReportService');

// Run cleanup daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running trade report cleanup...');
  try {
    const result = await tradeReportService.cleanupExpiredReports();
    console.log(`Cleanup completed: ${result.message}`);
  } catch (error) {
    console.error('Trade report cleanup failed:', error);
  }
});
```

### 5. Database Setup

The TradeReport model will be automatically created. MongoDB TTL index ensures expired reports are deleted automatically.

Ensure your MongoDB connection is active before using the service.

## Verification

### Test the Service

1. **Generate a test report:**

```bash
curl -X POST http://localhost:3000/api/trade-reports \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "reportType": "custom",
    "format": "excel",
    "filters": {
      "status": "Filled"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending",
    "message": "Report generation started"
  }
}
```

2. **Check report status:**

```bash
curl http://localhost:3000/api/trade-reports/{reportId}
```

3. **Download the report (when completed):**

```bash
curl -O http://localhost:3000/api/trade-reports/{reportId}/download
```

## Configuration Options

### Report Expiry

Default report expiry is 24 hours. Configure when generating reports:

```javascript
{
  "userId": "user123",
  "reportType": "custom",
  "format": "excel",
  "expiryHours": 48  // Reports expire after 48 hours
}
```

### Supported Formats

- `excel` - Multi-sheet Excel workbook with charts and formatting
- `csv` - Simple CSV for data analysis tools
- `json` - Structured JSON for programmatic access

### Report Types

- `daily` - Daily trading report
- `weekly` - Weekly summary
- `monthly` - Monthly summary
- `custom` - Custom date range
- `profit_loss` - P&L focused report
- `tax` - Tax reporting format
- `performance` - Performance analytics

## Integration Examples

### React/Frontend Integration

```javascript
import React, { useState } from 'react';

const TradeReportGenerator = ({ userId }) => {
  const [reportId, setReportId] = useState(null);
  const [status, setStatus] = useState('idle');

  const generateReport = async () => {
    setStatus('generating');
    
    const response = await fetch('/api/trade-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        reportType: 'monthly',
        format: 'excel',
        filters: {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        }
      })
    });

    const { data } = await response.json();
    setReportId(data.reportId);
    pollReportStatus(data.reportId);
  };

  const pollReportStatus = async (id) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/trade-reports/${id}`);
      const { data: report } = await response.json();

      if (report.status === 'completed') {
        clearInterval(interval);
        setStatus('completed');
        // Auto-download
        window.location.href = `/api/trade-reports/${id}/download`;
      } else if (report.status === 'failed') {
        clearInterval(interval);
        setStatus('failed');
        alert(`Report generation failed: ${report.errorMessage}`);
      }
    }, 2000);
  };

  return (
    <div>
      <button onClick={generateReport} disabled={status === 'generating'}>
        {status === 'generating' ? 'Generating...' : 'Generate Report'}
      </button>
      {status === 'completed' && <p>Report downloaded!</p>}
    </div>
  );
};
```

### Node.js/Backend Integration

```javascript
const tradeReportService = require('./services/tradeReportService');

// Generate report programmatically
async function generateUserReport(userId) {
  try {
    const result = await tradeReportService.generateReport(userId, {
      reportType: 'monthly',
      format: 'excel',
      filters: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      },
      expiryHours: 48
    });

    console.log('Report generated:', result.reportId);
    
    // Wait for completion (in production, use event/queue system)
    let attempts = 0;
    while (attempts < 30) {
      const status = await tradeReportService.getReportStatus(result.reportId);
      
      if (status.status === 'completed') {
        console.log('Report ready:', status.fileUrl);
        return status;
      } else if (status.status === 'failed') {
        throw new Error(status.errorMessage);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    throw new Error('Report generation timeout');
  } catch (error) {
    console.error('Report generation failed:', error);
    throw error;
  }
}
```

## Monitoring

### Check Service Health

```bash
# Get report history for a user
curl "http://localhost:3000/api/trade-reports/user/test-user/history?limit=10"

# Get user analytics
curl "http://localhost:3000/api/trade-reports/user/test-user/analytics"

# Get available trading pairs
curl "http://localhost:3000/api/trade-reports/filters/pairs?userId=test-user"
```

### Monitor Report Generation

Watch for these log messages:
- "Report generation started" - Report queued
- "Failed to process report" - Generation error
- "Cleanup completed" - Expired reports cleaned

### Check Disk Space

Reports are stored in `Backend/temp/reports/`. Monitor disk usage:

```bash
du -sh Backend/temp/reports/
```

## Troubleshooting

### Issue: Reports not generating

**Solution:**
1. Check MongoDB connection
2. Verify Order model has trade data
3. Check service logs for errors
4. Ensure reports directory exists and is writable

### Issue: Download returns 404

**Solution:**
1. Verify report status is 'completed'
2. Check file exists in `Backend/temp/reports/`
3. Ensure static file serving is configured correctly
4. Check report hasn't expired

### Issue: Performance degradation

**Solution:**
1. Reduce report expiry time to minimize storage
2. Run cleanup more frequently
3. Add pagination for large histories
4. Consider moving to background queue (Bull/Agenda)

### Issue: Memory errors with large reports

**Solution:**
1. Limit trades per report (add maxTrades config)
2. Use streaming for Excel generation (already implemented)
3. Increase Node.js heap size: `node --max-old-space-size=4096`

## Security Checklist

- [ ] Add authentication middleware to all endpoints
- [ ] Implement user authorization (users can only access their reports)
- [ ] Add rate limiting for report generation
- [ ] Validate and sanitize all input parameters
- [ ] Secure report file access (no direct file system access)
- [ ] Implement CSRF protection for POST endpoints
- [ ] Add audit logging for report generation and downloads
- [ ] Encrypt sensitive data in reports (optional)
- [ ] Implement file virus scanning (optional, for production)

## Performance Optimization

### For High-Volume Deployments

1. **Use Background Queue:**
```bash
npm install bull
```

Move report generation to Bull queue for better scalability.

2. **Add Redis Caching:**
Cache frequently accessed report metadata.

3. **Database Optimization:**
```javascript
// Add compound indexes
db.orders.createIndex({ userId: 1, updatedAt: -1 });
db.orders.createIndex({ userId: 1, pair: 1, status: 1 });
```

4. **File Storage:**
Consider moving to S3/Cloud Storage for production:
- Better scalability
- Automatic cleanup
- CDN distribution
- Reduced server storage

## Next Steps

1. Install dependencies: `npm install exceljs`
2. Create reports directory
3. Integrate routes with your server
4. Test with sample data
5. Add authentication/authorization
6. Set up scheduled cleanup
7. Monitor performance and disk usage

## Support

For issues or questions:
1. Check TRADE_REPORTS.md for detailed API documentation
2. Review error logs in service
3. Verify all dependencies are installed
4. Ensure MongoDB indexes are created

## Migration from Existing Export System

If you have an existing export system:

1. Map your existing export format to new report types
2. Migrate historical export metadata to TradeReport model
3. Update frontend to use new API endpoints
4. Run both systems in parallel during transition
5. Deprecate old system after validation period

Example migration script:
```javascript
// Migrate old exports to new format
const oldExports = await OldExportModel.find({});

for (const oldExport of oldExports) {
  const newReport = new TradeReport({
    reportId: oldExport.id,
    userId: oldExport.userId,
    reportType: 'custom',
    format: oldExport.format,
    status: 'completed',
    generatedAt: oldExport.createdAt,
    // ... map other fields
  });
  
  await newReport.save();
}
```
