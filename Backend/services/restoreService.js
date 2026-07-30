const crypto = require('crypto');

let AWS;
try {
  AWS = require('aws-sdk');
} catch (error) {
  AWS = null;
}

class RestoreService {
  constructor() {
    this.operations = new Map();
    this.timers = new Map();
    this.s3Client = null;
    this.s3Bucket = process.env.RESTORE_S3_BUCKET || process.env.AWS_S3_BUCKET || null;
    this.initializeAwsClient();
  }

  initializeAwsClient() {
    if (!AWS) {
      return;
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      return;
    }

    this.s3Client = new AWS.S3({ region });
  }

  async requestRestore(input = {}) {
    const restoreId = input.restoreId || crypto.randomUUID();
    const payload = await this.resolvePayload(input);
    const validation = this.validateRestoreData(payload);

    const operation = {
      restoreId,
      status: 'queued',
      requestedAt: new Date().toISOString(),
      requestedBy: input.requestedBy || 'system',
      backupId: input.backupId || null,
      scheduledAt: input.scheduledFor ? new Date(input.scheduledFor).toISOString() : null,
      progress: {
        current: 0,
        total: validation.totalSteps || 1,
        percent: 0,
        step: 'Queued for restore',
      },
      validation,
      source: input.backupId ? 'storage' : 'request',
      data: payload,
    };

    this.operations.set(restoreId, operation);

    if (!validation.valid) {
      operation.status = 'invalid';
      operation.progress.step = 'Validation failed';
      operation.error = validation.errors.join(', ');
      return operation;
    }

    if (operation.scheduledAt) {
      operation.status = 'scheduled';
      operation.progress.step = 'Restore scheduled';
      this.scheduleRestore(restoreId, operation.scheduledAt);
      return operation;
    }

    await this.executeRestore(restoreId);
    return this.getStatus(restoreId);
  }

  async resolvePayload(input) {
    if (input.data !== undefined || input.payload !== undefined) {
      return input.data ?? input.payload;
    }

    if (!input.backupId) {
      return input;
    }

    const remoteData = await this.fetchBackupFromStorage(input.backupId);
    return remoteData ?? input;
  }

  async fetchBackupFromStorage(backupId) {
    if (!this.s3Client || !this.s3Bucket || !backupId) {
      return null;
    }

    try {
      const response = await this.s3Client
        .getObject({ Bucket: this.s3Bucket, Key: backupId })
        .promise();
      const body = response.Body;
      if (!body) {
        return null;
      }
      if (typeof body === 'string') {
        return JSON.parse(body);
      }
      return JSON.parse(body.toString('utf8'));
    } catch (error) {
      console.warn('Restore backup fetch failed:', error.message);
      return null;
    }
  }

  validateRestoreData(payload) {
    const errors = [];
    let normalizedPayload = payload;

    if (typeof payload === 'string') {
      try {
        normalizedPayload = JSON.parse(payload);
      } catch (error) {
        errors.push('Restore data must be valid JSON when provided as a string');
      }
    }

    if (normalizedPayload == null) {
      errors.push('Restore data is required');
      return { valid: false, errors, totalSteps: 0 };
    }

    if (Array.isArray(normalizedPayload)) {
      if (normalizedPayload.length === 0) {
        errors.push('Restore data array cannot be empty');
      }
      return {
        valid: errors.length === 0,
        errors,
        totalSteps: normalizedPayload.length || 0,
        normalizedPayload,
      };
    }

    if (typeof normalizedPayload !== 'object') {
      errors.push('Restore data must be an object or array');
      return { valid: false, errors, totalSteps: 0 };
    }

    const records = normalizedPayload.records || normalizedPayload.marketData || normalizedPayload.data;
    if (Array.isArray(records)) {
      if (records.length === 0) {
        errors.push('Restore records cannot be empty');
      }
      return {
        valid: errors.length === 0,
        errors,
        totalSteps: records.length || 0,
        normalizedPayload,
      };
    }

    if (!normalizedPayload.marketId && !normalizedPayload.market && !normalizedPayload.id) {
      errors.push('Restore payload must include a market identifier');
    }

    if (!normalizedPayload.snapshot && !normalizedPayload.backup && !normalizedPayload.data) {
      errors.push('Restore payload must include snapshot or backup content');
    }

    return {
      valid: errors.length === 0,
      errors,
      totalSteps: normalizedPayload.records?.length || normalizedPayload.marketData?.length || 1,
      normalizedPayload,
    };
  }

  async executeRestore(restoreId) {
    const operation = this.operations.get(restoreId);
    if (!operation) {
      return null;
    }

    operation.status = 'in_progress';
    operation.startedAt = new Date().toISOString();
    operation.progress.step = 'Validating restore payload';

    if (!operation.validation.valid) {
      operation.status = 'invalid';
      operation.progress.step = 'Validation failed';
      return operation;
    }

    const totalSteps = Math.max(1, operation.validation.totalSteps || 1);
    operation.progress.total = totalSteps;

    for (let index = 0; index < totalSteps; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      operation.progress.current = index + 1;
      operation.progress.percent = Math.round(((index + 1) / totalSteps) * 100);
      operation.progress.step = `Restoring record ${index + 1} of ${totalSteps}`;
      operation.updatedAt = new Date().toISOString();
    }

    operation.status = 'completed';
    operation.progress.percent = 100;
    operation.progress.step = 'Restore completed successfully';
    operation.completedAt = new Date().toISOString();
    operation.result = {
      restoredItems: totalSteps,
      message: 'Market data restore completed successfully',
    };

    return operation;
  }

  scheduleRestore(restoreId, scheduledAt) {
    const timeToRun = new Date(scheduledAt).getTime() - Date.now();
    if (Number.isNaN(timeToRun)) {
      throw new Error('Invalid scheduledAt value');
    }

    const timer = setTimeout(async () => {
      this.timers.delete(restoreId);
      await this.executeRestore(restoreId);
    }, Math.max(0, timeToRun));

    this.timers.set(restoreId, timer);
  }

  getStatus(restoreId) {
    return this.operations.get(restoreId) || null;
  }

  listStatuses() {
    return Array.from(this.operations.values()).sort(
      (left, right) => new Date(right.requestedAt) - new Date(left.requestedAt)
    );
  }

  validateRequest(payload) {
    return this.validateRestoreData(payload);
  }
}

module.exports = new RestoreService();
