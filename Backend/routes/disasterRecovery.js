/**
 * DISASTER RECOVERY ROUTES
 * API endpoints for disaster recovery procedures.
 */

const express = require('express');
const recoveryService = require('../services/recoveryService');

const router = express.Router();

// Wrap async route handlers and handle errors gracefully
const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    console.error('Disaster Recovery Route Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RECOVERY_ERROR',
    });
  }
};

/**
 * POST /disaster-recovery/trigger
 * Trigger a new recovery job (manual or automated).
 */
router.post(
  '/trigger',
  handleErrors(async (req, res) => {
    const { type, description, backupId } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Recovery type is required',
        code: 'MISSING_TYPE',
      });
    }

    const job = await recoveryService.createRecoveryJob({
      type,
      triggerType: recoveryService.TRIGGER_TYPES.MANUAL,
      description,
      backupId,
    });

    // Start execution immediately for manual triggers
    if (job.status === recoveryService.RECOVERY_STATUS.PENDING) {
      await recoveryService.executeRecoveryJob(job.id);
    }

    res.status(201).json({
      success: true,
      data: job,
    });
  })
);

/**
 * POST /disaster-recovery/schedule
 * Schedule a recovery job for later execution.
 */
router.post(
  '/schedule',
  handleErrors(async (req, res) => {
    const { type, scheduledTime, description, backupId } = req.body;

    if (!type || !scheduledTime) {
      return res.status(400).json({
        success: false,
        error: 'Recovery type and scheduled time are required',
        code: 'MISSING_PARAMS',
      });
    }

    const scheduleDate = new Date(scheduledTime);
    if (isNaN(scheduleDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scheduled time format',
        code: 'INVALID_SCHEDULE',
      });
    }

    if (scheduleDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future',
        code: 'PAST_SCHEDULE',
      });
    }

    const job = await recoveryService.createRecoveryJob({
      type,
      triggerType: recoveryService.TRIGGER_TYPES.SCHEDULED,
      scheduledTime: scheduleDate.toISOString(),
      description,
      backupId,
    });

    res.status(201).json({
      success: true,
      data: job,
    });
  })
);

/**
 * GET /disaster-recovery/status/:jobId
 * Get the status of a specific recovery job.
 */
router.get(
  '/status/:jobId',
  handleErrors(async (req, res) => {
    const { jobId } = req.params;
    const job = await recoveryService.getRecoveryJob(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Recovery job not found',
        code: 'JOB_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: job,
    });
  })
);

/**
 * GET /disaster-recovery/jobs
 * Get all recovery jobs with optional filters.
 */
router.get(
  '/jobs',
  handleErrors(async (req, res) => {
    const { status, type, triggerType } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (triggerType) filters.triggerType = triggerType;

    const jobs = await recoveryService.getRecoveryJobs(filters);

    res.json({
      success: true,
      data: jobs,
      count: jobs.length,
    });
  })
);

/**
 * GET /disaster-recovery/reports
 * Get recovery reports.
 */
router.get(
  '/reports',
  handleErrors(async (req, res) => {
    const { jobId } = req.query;
    
    const filters = {};
    if (jobId) filters.jobId = jobId;

    const reports = await recoveryService.getRecoveryReports(filters);

    res.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  })
);

/**
 * GET /disaster-recovery/reports/:reportId
 * Get a specific recovery report.
 */
router.get(
  '/reports/:reportId',
  handleErrors(async (req, res) => {
    const { reportId } = req.params;
    const report = await recoveryService.getRecoveryReport(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Recovery report not found',
        code: 'REPORT_NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: report,
    });
  })
);

/**
 * DELETE /disaster-recovery/jobs/:jobId
 * Cancel a scheduled recovery job.
 */
router.delete(
  '/jobs/:jobId',
  handleErrors(async (req, res) => {
    const { jobId } = req.params;
    
    try {
      const job = await recoveryService.cancelRecoveryJob(jobId);
      
      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message,
          code: 'JOB_NOT_FOUND',
        });
      }
      if (error.message.includes('in progress') || error.message.includes('already completed')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          code: 'INVALID_STATE',
        });
      }
      throw error;
    }
  })
);

module.exports = router;