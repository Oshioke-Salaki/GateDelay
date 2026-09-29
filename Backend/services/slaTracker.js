/**
 * SLA Tracker Service
 * Handles SLA threshold definitions, compliance tracking,
 * violation detection, and report generation.
 */

const SLA_THRESHOLDS = {
  responseTime: {
    excellent: 200,
    good: 500,
    acceptable: 1000,
    poor: 2000,
  },
  availability: {
    target: 99.9,
    warning: 99.5,
    critical: 99.0,
  },
  errorRate: {
    target: 0.1,
    warning: 1.0,
    critical: 5.0,
  },
  throughput: {
    minRequestsPerMinute: 10,
  },
};

let slaMetrics = [];
let slaViolations = [];
let slaReports = [];

function recordMetric({ endpoint, responseTime, statusCode }) {
  const metric = {
    id: `metric_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    endpoint: endpoint || 'unknown',
    responseTime,
    statusCode,
    isError: statusCode >= 500,
  };
  slaMetrics.push(metric);
  if (slaMetrics.length > 10000) slaMetrics = slaMetrics.slice(-10000);
  _checkViolations(metric);
  return metric;
}

function calculateCompliance(windowMinutes = 60) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const window = slaMetrics.filter((m) => m.timestamp >= cutoff);
  if (window.length === 0) {
    return { window: `${windowMinutes}m`, totalRequests: 0, compliance: null, message: 'No data in window' };
  }
  const avgResponseTime = window.reduce((sum, m) => sum + m.responseTime, 0) / window.length;
  const errorCount = window.filter((m) => m.isError).length;
  const errorRate = (errorCount / window.length) * 100;
  const compliantRequests = window.filter(
    (m) => m.responseTime <= SLA_THRESHOLDS.responseTime.poor && !m.isError
  ).length;
  const complianceRate = (compliantRequests / window.length) * 100;
  return {
    window: `${windowMinutes}m`,
    totalRequests: window.length,
    avgResponseTime: Math.round(avgResponseTime),
    errorRate: parseFloat(errorRate.toFixed(2)),
    complianceRate: parseFloat(complianceRate.toFixed(2)),
    thresholds: SLA_THRESHOLDS,
    status: _overallStatus({ avgResponseTime, errorRate }),
    responseTimeOk: avgResponseTime <= SLA_THRESHOLDS.responseTime.poor,
    errorRateOk: errorRate <= SLA_THRESHOLDS.errorRate.critical,
  };
}

function _checkViolations(metric) {
  const violations = [];
  if (metric.responseTime > SLA_THRESHOLDS.responseTime.poor) {
    violations.push({ type: 'RESPONSE_TIME', severity: 'CRITICAL', message: `Response time ${metric.responseTime}ms exceeds threshold of ${SLA_THRESHOLDS.responseTime.poor}ms`, metric });
  } else if (metric.responseTime > SLA_THRESHOLDS.responseTime.acceptable) {
    violations.push({ type: 'RESPONSE_TIME', severity: 'WARNING', message: `Response time ${metric.responseTime}ms exceeds acceptable threshold`, metric });
  }
  if (metric.isError) {
    violations.push({ type: 'ERROR_RATE', severity: 'HIGH', message: `HTTP ${metric.statusCode} error on ${metric.endpoint}`, metric });
  }
  violations.forEach((v) => {
    const violation = { id: `vio_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toISOString(), ...v };
    slaViolations.push(violation);
    if (slaViolations.length > 5000) slaViolations = slaViolations.slice(-5000);
  });
}

function getViolations({ limit = 50, severity, type } = {}) {
  let filtered = [...slaViolations].reverse();
  if (severity) filtered = filtered.filter((v) => v.severity.toUpperCase() === severity.toUpperCase());
  if (type) filtered = filtered.filter((v) => v.type.toUpperCase() === type.toUpperCase());
  return filtered.slice(0, limit);
}

function generateReport(windowMinutes = 1440) {
  const compliance = calculateCompliance(windowMinutes);
  const violations = getViolations({ limit: 100 });
  const violationBreakdown = violations.reduce((acc, v) => { acc[v.type] = (acc[v.type] || 0) + 1; return acc; }, {});
  const report = {
    id: `report_${Date.now()}`,
    generatedAt: new Date().toISOString(),
    period: `${windowMinutes} minutes`,
    summary: compliance,
    violations: { total: violations.length, breakdown: violationBreakdown, recent: violations.slice(0, 10) },
    thresholds: SLA_THRESHOLDS,
    recommendation: _buildRecommendation(compliance),
  };
  slaReports.push(report);
  if (slaReports.length > 100) slaReports = slaReports.slice(-100);
  return report;
}

function getReports(limit = 10) {
  return [...slaReports].reverse().slice(0, limit);
}

function getDashboardData() {
  return {
    realtime: calculateCompliance(5),
    hourly: calculateCompliance(60),
    daily: calculateCompliance(1440),
    recentViolations: getViolations({ limit: 20 }),
    thresholds: SLA_THRESHOLDS,
    totalMetricsTracked: slaMetrics.length,
    totalViolations: slaViolations.length,
  };
}

function _overallStatus({ avgResponseTime, errorRate }) {
  if (avgResponseTime > SLA_THRESHOLDS.responseTime.poor || errorRate > SLA_THRESHOLDS.errorRate.critical) return 'CRITICAL';
  if (avgResponseTime > SLA_THRESHOLDS.responseTime.acceptable || errorRate > SLA_THRESHOLDS.errorRate.warning) return 'WARNING';
  return 'HEALTHY';
}

function _buildRecommendation(compliance) {
  if (!compliance.complianceRate) return 'Insufficient data.';
  if (compliance.complianceRate >= 99.9) return 'SLA targets are being met. No action required.';
  if (compliance.complianceRate >= 99.0) return 'Minor SLA degradation detected. Monitor closely.';
  if (compliance.complianceRate >= 95.0) return 'SLA compliance below target. Investigate latency and error spikes.';
  return 'Critical SLA breach. Immediate investigation required.';
}

module.exports = { SLA_THRESHOLDS, recordMetric, calculateCompliance, getViolations, generateReport, getReports, getDashboardData };