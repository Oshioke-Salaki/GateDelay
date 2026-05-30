const express = require('express');
const exportService = require('../services/exportService');

const router = express.Router();

const handleErrors = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res, next);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'EXPORT_ERROR',
    });
  }
};

router.post(
  '/',
  handleErrors(async (req, res) => {
    const { userId, dataType, format, options } = req.body;
    const jobId = await exportService.exportData(userId, dataType, format, options);
    res.json({ success: true, jobId });
  })
);

router.get(
  '/status/:jobId',
  handleErrors(async (req, res) => {
    const { jobId } = req.params;
    const status = exportService.getExportStatus(jobId);
    res.json({ success: true, status });
  })
);

router.get(
  '/download/:jobId',
  handleErrors(async (req, res) => {
    const { jobId } = req.params;
    const job = exportService.getExportStatus(jobId);
    
    if (!job || job.status !== 'completed') {
      return res.status(404).json({ success: false, error: 'Export not ready' });
    }

    const data = exportService.getExportData(jobId);
    const extension = job.format === 'csv' ? 'csv' : 'json';
    const filename = `${job.dataType}_export.${extension}`;
    
    res.setHeader('Content-Type', job.format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  })
);

router.post(
  '/schedule',
  handleErrors(async (req, res) => {
    const { userId, dataType, format, cronExpression, options } = req.body;
    const scheduleId = exportService.scheduleExport(userId, dataType, format, cronExpression, options);
    res.json({ success: true, scheduleId });
  })
);

router.delete(
  '/schedule/:scheduleId',
  handleErrors(async (req, res) => {
    const { scheduleId } = req.params;
    const result = exportService.cancelScheduledExport(scheduleId);
    res.json({ success: result.success });
  })
);

router.get(
  '/schedule/:userId',
  handleErrors(async (req, res) => {
    const { userId } = req.params;
    const schedules = exportService.listScheduledExports(userId);
    res.json({ success: true, schedules });
  })
);

module.exports = router;
