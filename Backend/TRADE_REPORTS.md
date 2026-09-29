# Trade Report Service Documentation

## Overview

The Trade Report Service provides comprehensive trade reporting capabilities for the GateDelay trading platform. It supports generating detailed reports in multiple formats (Excel, CSV, JSON), tracking report history, filtering trades, exporting data, and providing analytics insights.

## Features

### ✅ Core Capabilities

1. **Report Generation**
   - Asynchronous report generation
   - Multiple report types (daily, weekly, monthly, custom, profit/loss, tax, performance)
   - Support for multiple formats (Excel, CSV, JSON)
   - Automatic expiration with TTL

2. **History Tracking**
   - Complete report generation history per user
   - Status tracking (pending, processing, completed, failed)
   - Pagination support for large histories

3. **Advanced Filtering**
   - Filter by trading pair
   - Filter by side (Buy/Sell)
   - Filter by order status
   - Date range filtering
   - Amount range filtering

4. **Export Support**
   - Excel exports with multiple worksheets
   - CSV exports for data analysis
   - JSON exports for programmatic access
   - Quick synchronous exports for small datasets

5. **Analytics**
   - Trade summary metrics
   - Top trading pairs by volume
   - Hourly distribution analysis
   - Performance by pair
   - Win rate calculations
   - Profit/loss tracking

## Architecture

### Models

#### TradeReport Model
```javascript
{
  reportId: String (unique, indexed),
  userId: String (indexed),
  reportType: Enum ['daily', 'weekly', 'monthly', 'custom', 'profit_loss', 'tax', 'performance'],
  filters: {
    pair: String,
    side: Enum ['Buy', 'Sell'],
    status: String,
    startDate: Date,
    endDate: Date,
    minAmount: String,
    maxAmount: String
  },
  generatedAt: Date (indexed),
  status: Enum ['pending', 'processing', 'completed', 'failed'] (indexed),
  format: Enum ['json', 'csv', 'excel', 'pdf'],
  summary: {
    totalTrades: Number,
    totalVolume: String,
    totalBuyVolume: String,
    totalSellVolume: String,
    avgTradeSize: String,
    profitLoss: String,
    winRate: Number,
    bestTrade: String,
    worstTrade: String
  },
  analytics: {
    topPairs: Array,
    hourlyDistribution: Array,
    performanceByPair: Array
  },
  fileUrl: String,
  fileSize: Number,
  errorMessage: String,
  expiresAt: Date (TTL index)
}
```

## API Reference

### 1. Generate Report

**Endpoint:** `POST /api/trade-reports`

**Description:** Generate a new trade report asynchronously

**Request Body:**
```json
{
  "userId": "user123",
  "reportType": "custom",
  "format": "excel",
  "filters": {
    "pair": "ETH-USDT",
    "side": "Buy",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z",
    "minAmount": "100",
    "maxAmount": "10000"
  },
  "includeAnalytics": true,
  "expiryHours": 24
}
```

**Response:**
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

---

### 2. Get Report Status

**Endpoint:** `GET /api/trade-reports/:reportId`

**Description:** Get the current status and details of a report

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "reportType": "custom",
    "format": "excel",
    "generatedAt": "2024-01-15T10:30:00Z",
    "fileUrl": "/reports/trade_report_550e8400.xlsx",
    "fileSize": 45678,
    "summary": {
      "totalTrades": 150,
      "totalVolume": "1250000.00",
      "totalBuyVolume": "625000.00",
      "totalSellVolume": "625000.00",
      "avgTradeSize": "8333.33",
      "profitLoss": "15750.00",
      "winRate": 65.5,
      "bestTrade": "2500.00",
      "worstTrade": "-1200.00"
    },
    "expiresAt": "2024-01-16T10:30:00Z"
  }
}
```

---

### 3. Download Report

**Endpoint:** `GET /api/trade-reports/:reportId/download`

**Description:** Download the generated report file

**Response:** File stream (Excel, CSV, or JSON)

**Headers:**
- `Content-Type`: Appropriate MIME type
- `Content-Disposition`: Attachment with filename
- `Content-Length`: File size

---

### 4. Get Report History

**Endpoint:** `GET /api/trade-reports/user/:userId/history`

**Description:** Get paginated report history for a user with filtering

**Query Parameters:**
- `limit` (number, default: 20): Number of reports to return
- `skip` (number, default: 0): Number of reports to skip
- `status` (string, optional): Filter by status
- `reportType` (string, optional): Filter by report type

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "reportId": "550e8400-e29b-41d4-a716-446655440000",
        "reportType": "custom",
        "format": "excel",
        "status": "completed",
        "generatedAt": "2024-01-15T10:30:00Z",
        "summary": {
          "totalTrades": 150,
          "totalVolume": "1250000.00"
        }
      }
    ],
    "total": 45,
    "limit": 20,
    "skip": 0,
    "hasMore": true
  }
}
```

---

### 5. Get User Report Analytics

**Endpoint:** `GET /api/trade-reports/user/:userId/analytics`

**Description:** Get analytics summary for user's report generation activity

**Response:**
```json
{
  "success": true,
  "data": {
    "totalReports": 45,
    "completedReports": 42,
    "failedReports": 2,
    "recentReports": [
      {
        "reportId": "550e8400-e29b-41d4-a716-446655440000",
        "reportType": "custom",
        "status": "completed",
        "generatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "reportsByType": [
      { "type": "custom", "count": 25 },
      { "type": "monthly", "count": 12 },
      { "type": "profit_loss", "count": 8 }
    ]
  }
}
```

---

### 6. Delete Report

**Endpoint:** `DELETE /api/trade-reports/:reportId`

**Description:** Delete a report and its associated file

**Request Body:**
```json
{
  "userId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Report deleted"
  }
}
```

---

### 7. Quick Export

**Endpoint:** `POST /api/trade-reports/export/quick`

**Description:** Synchronous quick export for small datasets (no report record created)

**Request Body:**
```json
{
  "userId": "user123",
  "format": "csv",
  "filters": {
    "pair": "BTC-USDT",
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }
}
```

**Response:** File stream (CSV or JSON)

---

### 8. Get Available Pairs

**Endpoint:** `GET /api/trade-reports/filters/pairs`

**Description:** Get list of available trading pairs for filtering

**Query Parameters:**
- `userId` (string, optional): Get user-specific pairs

**Response:**
```json
{
  "success": true,
  "data": {
    "pairs": ["BTC-USDT", "ETH-USDT", "SOL-USDT"]
  }
}
```

---

### 9. Get Date Range

**Endpoint:** `GET /api/trade-reports/filters/date-range?userId=user123`

**Description:** Get available date range for user's trades

**Response:**
```json
{
  "success": true,
  "data": {
    "oldestTradeDate": "2023-01-01T00:00:00Z",
    "newestTradeDate": "2024-01-15T15:45:00Z"
  }
}
```

---

### 10. Cleanup Expired Reports

**Endpoint:** `POST /api/trade-reports/cleanup`

**Description:** Clean up expired reports (admin endpoint)

**Response:**
```json
{
  "success": true,
  "data": {
    "deletedCount": 25,
    "message": "Cleaned up 25 expired reports"
  }
}
```

## Excel Report Structure

Generated Excel reports contain multiple worksheets:

### 1. Summary Sheet
- Total Trades
- Total Volume
- Total Buy/Sell Volume
- Average Trade Size
- Profit/Loss
- Win Rate
- Best/Worst Trade

### 2. Trades Sheet
- Date
- Pair
- Side
- Type
- Price
- Amount
- Value
- Status

### 3. Top Pairs Sheet
- Pair
- Volume
- Trade Count

### 4. Performance by Pair Sheet
- Pair
- Profit/Loss
- Win Rate

## Usage Examples

### Example 1: Generate Monthly Report

```javascript
const response = await fetch('/api/trade-reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    reportType: 'monthly',
    format: 'excel',
    filters: {
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-31T23:59:59Z'
    },
    includeAnalytics: true,
    expiryHours: 48
  })
});

const { data } = await response.json();
console.log('Report ID:', data.reportId);

// Poll for completion
const checkStatus = async (reportId) => {
  const statusResponse = await fetch(`/api/trade-reports/${reportId}`);
  const { data: report } = await statusResponse.json();
  
  if (report.status === 'completed') {
    window.location.href = `/api/trade-reports/${reportId}/download`;
  } else if (report.status === 'failed') {
    console.error('Report failed:', report.errorMessage);
  } else {
    setTimeout(() => checkStatus(reportId), 2000);
  }
};

checkStatus(data.reportId);
```

### Example 2: Filter by Pair and Date Range

```javascript
await fetch('/api/trade-reports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    reportType: 'custom',
    format: 'csv',
    filters: {
      pair: 'ETH-USDT',
      side: 'Buy',
      startDate: '2024-01-01T00:00:00Z',
      endDate: '2024-01-31T23:59:59Z',
      minAmount: '1000'
    }
  })
});
```

### Example 3: Quick Export

```javascript
const response = await fetch('/api/trade-reports/export/quick', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',
    format: 'csv',
    filters: {
      pair: 'BTC-USDT'
    }
  })
});

// Download immediately
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'trades.csv';
a.click();
```

## Performance Considerations

### Report Generation
- Reports are generated asynchronously to avoid blocking
- Large reports (>10,000 trades) may take 30-60 seconds
- Status polling recommended every 2-3 seconds

### File Storage
- Reports expire after configurable period (default 24 hours)
- MongoDB TTL index automatically deletes expired reports
- Run cleanup endpoint periodically to remove orphaned files

### Database Optimization
- Indexes on userId, generatedAt, status for fast queries
- Lean queries used where full documents not needed
- Pagination prevents memory issues with large histories

### Memory Management
- ExcelJS uses streaming for large files
- Big.js used for precise decimal arithmetic
- Trades fetched in single query then processed in memory

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "TRADE_REPORT_ERROR"
}
```

Common error scenarios:
- Missing required parameters (400)
- Report not found (404)
- Report not ready for download (400)
- File not found on server (404)
- Processing errors (500)

## Security Considerations

1. **Authorization**: All endpoints should be protected with authentication middleware
2. **User Isolation**: Reports are filtered by userId to prevent unauthorized access
3. **File Access**: Report files should only be accessible to the owning user
4. **Input Validation**: All filter parameters should be validated
5. **Rate Limiting**: Consider rate limiting report generation to prevent abuse

## Integration with Server

Add to your Express app:

```javascript
const tradeReportsRouter = require('./routes/tradeReports');

app.use('/api/trade-reports', tradeReportsRouter);

// Serve report files
app.use('/reports', express.static(path.join(__dirname, 'temp', 'reports')));
```

## Scheduled Cleanup

Set up a cron job to clean expired reports:

```javascript
const cron = require('node-cron');
const tradeReportService = require('./services/tradeReportService');

// Run cleanup daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running report cleanup...');
  try {
    const result = await tradeReportService.cleanupExpiredReports();
    console.log('Cleanup completed:', result);
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
});
```

## Dependencies

Required npm packages:
- `exceljs` - Excel file generation
- `mongoose` - MongoDB ODM
- `big.js` - Precise decimal math
- `uuid` - Report ID generation
- `json2csv` - CSV generation

Install with:
```bash
npm install exceljs mongoose big.js uuid json2csv
```

## Testing

### Manual Testing

1. Generate a report:
```bash
curl -X POST http://localhost:3000/api/trade-reports \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "reportType": "custom",
    "format": "excel"
  }'
```

2. Check status:
```bash
curl http://localhost:3000/api/trade-reports/{reportId}
```

3. Download:
```bash
curl -O http://localhost:3000/api/trade-reports/{reportId}/download
```

## Troubleshooting

### Report Stuck in Processing
- Check service logs for errors
- Verify MongoDB connection
- Ensure adequate memory for large datasets
- Check file system permissions for report directory

### File Not Found Errors
- Verify reports directory exists: `Backend/temp/reports/`
- Check file permissions
- Ensure cleanup hasn't removed active reports
- Verify correct file path generation

### Performance Issues
- Add database indexes if not present
- Consider pagination for large trade histories
- Implement caching for frequently accessed pairs
- Use background workers for very large reports

## Future Enhancements

- [ ] PDF report generation
- [ ] Email delivery of completed reports
- [ ] Scheduled recurring reports
- [ ] Report templates/presets
- [ ] Interactive charts in Excel
- [ ] Multi-currency support
- [ ] Tax jurisdiction-specific reports
- [ ] Comparison reports (period vs period)
- [ ] Portfolio performance metrics
