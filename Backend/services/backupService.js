/**
 * BACKUP SERVICE
 * Handles automated backups, status tracking, retention policies, and restoration.
 */

const AWS = require('aws-sdk');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createReadStream, createWriteStream } = require('fs');

// Initialize AWS clients
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const dynamodb = new AWS.DynamoDB({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Backup status constants
const BACKUP_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  VERIFIED: 'VERIFIED',
};

// Backup types
const BACKUP_TYPES = {
  FULL: 'FULL',
  INCREMENTAL: 'INCREMENTAL',
  DIFFERENTIAL: 'DIFFERENTIAL',
};

// In-memory storage (replace with database in production)
const backups = new Map();
const backupReports = new Map();
let backupIdCounter = 1;

/**
 * Create a new backup job
 */
async function createBackup(options) {
  const {
    type = BACKUP_TYPES.FULL,
    description = '',
    retentionDays = 30,
    source = [],
  } = options;

  const backup = {
    id: `backup-${backupIdCounter++}`,
    type,
    status: BACKUP_STATUS.PENDING,
    description,
    retentionDays,
    source,
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString(),
    progress: 0,
    size: 0,
    location: null,
    checksum: null,
    error: null,
    steps: [],
  };

  backups.set(backup.id, backup);
  return backup;
}

/**
 * Execute backup job
 */
async function executeBackup(backupId) {
  const backup = backups.get(backupId);
  if (!backup) {
    throw new Error(`Backup ${backupId} not found`);
  }

  backup.status = BACKUP_STATUS.IN_PROGRESS;
  backup.startedAt = new Date().toISOString();
  backup.progress = 0;

  try {
    // Step 1: Prepare backup
    backup.steps.push({ step: 'PREPARE', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    backup.progress = 10;
    
    await prepareBackup(backup);
    
    backup.steps[backup.steps.length - 1].status = 'COMPLETED';

    // Step 2: Collect data
    backup.steps.push({ step: 'COLLECT_DATA', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    backup.progress = 30;
    
    const archivePath = await collectData(backup);
    
    backup.steps[backup.steps.length - 1].status = 'COMPLETED';

    // Step 3: Compress
    backup.steps.push({ step: 'COMPRESS', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    backup.progress = 50;
    
    const compressedPath = await compressBackup(archivePath);
    
    backup.steps[backup.steps.length - 1].status = 'COMPLETED';

    // Step 4: Calculate checksum
    backup.steps.push({ step: 'CHECKSUM', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    backup.progress = 70;
    
    const checksum = await calculateChecksum(compressedPath);
    backup.checksum = checksum;
    
    backup.steps[backup.steps.length - 1].status = 'COMPLETED';

    // Step 5: Upload to S3
    backup.steps.push({ step: 'UPLOAD_S3', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    backup.progress = 85;
    
    const s3Location = await uploadToS3(backup, compressedPath);
    backup.location = s3Location;
    
    // Get file size
    const fileStats = fs.statSync(compressedPath);
    backup.size = fileStats.size;
    
    backup.steps[backup.steps.length - 1].status = 'COMPLETED';

    // Step 6: Verify
    backup.steps.push({ step: 'VERIFY', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    backup.progress = 95;
    
    await verifyBackup(backup);
    
    backup.steps[backup.steps.length - 1].status = 'COMPLETED';

    // Cleanup temporary files
    await cleanupTempFiles(archivePath, compressedPath);

    backup.status = BACKUP_STATUS.VERIFIED;
    backup.completedAt = new Date().toISOString();
    backup.progress = 100;

    // Generate report
    await generateBackupReport(backup);

    return backup;
  } catch (error) {
    backup.status = BACKUP_STATUS.FAILED;
    backup.error = error.message;
    backup.completedAt = new Date().toISOString();
    backup.steps.push({ 
      step: 'ERROR', 
      status: 'FAILED', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Prepare backup environment
 */
async function prepareBackup(backup) {
  console.log(`Preparing backup: ${backup.id}`);
  
  // In production, this would:
  // - Lock database tables if needed
  // - Create snapshots
  // - Set up temp storage
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return true;
}

/**
 * Collect data from sources
 */
async function collectData(backup) {
  console.log(`Collecting data for backup: ${backup.id}`);
  
  const archivePath = path.join(process.env.BACKUP_TEMP_DIR || '/tmp', `backup-${backup.id}-data.tar`);
  
  try {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(archivePath);
      const archive = archiver('tar', {});
      
      output.on('close', () => {
        console.log(`Data collected: ${archive.pointer()} bytes`);
        resolve(archivePath);
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      
      // Add data sources
      const dataSources = backup.source.length > 0 
        ? backup.source 
        : [process.env.DATA_DIR || './data'];
      
      for (const source of dataSources) {
        if (fs.existsSync(source)) {
          if (fs.lstatSync(source).isDirectory()) {
            archive.directory(source, path.basename(source));
          } else {
            archive.file(source, { name: path.basename(source) });
          }
        }
      }
      
      archive.finalize();
    });
  } catch (error) {
    console.error(`Error collecting data:`, error.message);
    throw error;
  }
}

/**
 * Compress backup using archiver
 */
async function compressBackup(archivePath) {
  console.log(`Compressing backup: ${archivePath}`);
  
  return new Promise((resolve, reject) => {
    const compressedPath = `${archivePath}.gz`;
    const output = createWriteStream(compressedPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      console.log(`Backup compressed: ${archive.pointer()} bytes`);
      resolve(compressedPath);
    });
    
    archive.on('error', (err) => {
      console.error(`Error during compression:`, err);
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add the archive file to compress
    if (fs.existsSync(archivePath)) {
      archive.file(archivePath, { name: path.basename(archivePath) });
    }
    
    archive.finalize();
  });
}

/**
 * Calculate checksum for verification
 */
async function calculateChecksum(filePath) {
  console.log(`Calculating checksum for: ${filePath}`);
  
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);
    
    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    
    stream.on('end', () => {
      const checksum = hash.digest('hex');
      console.log(`Checksum calculated: ${checksum}`);
      resolve(checksum);
    });
    
    stream.on('error', reject);
  });
}

/**
 * Upload backup to S3
 */
async function uploadToS3(backup, filePath) {
  console.log(`Uploading backup ${backup.id} to S3`);
  
  try {
    const fileStream = createReadStream(filePath);
    const fileSize = fs.statSync(filePath).size;
    
    const s3Key = `backups/${backup.id}/data-${Date.now()}.tar.gz`;
    const bucketName = process.env.AWS_BACKUP_BUCKET || 'backup-bucket';
    
    const params = {
      Bucket: bucketName,
      Key: s3Key,
      Body: fileStream,
      ContentLength: fileSize,
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA',
      Metadata: {
        'backup-id': backup.id,
        'backup-type': backup.type,
        'created-at': backup.createdAt,
      },
      Tagging: `backup-type=${backup.type}&retention=${backup.retentionDays}`,
    };
    
    const result = await s3.upload(params).promise();
    
    console.log(`Backup uploaded to S3: ${result.Location}`);
    return result.Location;
  } catch (error) {
    console.error(`Error uploading to S3:`, error.message);
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Verify backup integrity
 */
async function verifyBackup(backup) {
  console.log(`Verifying backup: ${backup.id}`);
  
  try {
    // Verify S3 object exists
    const bucketName = process.env.AWS_BACKUP_BUCKET || 'backup-bucket';
    const s3Key = backup.location.split('/').slice(-2).join('/');
    
    const headParams = {
      Bucket: bucketName,
      Key: s3Key,
    };
    
    const headResult = await s3.headObject(headParams).promise();
    
    console.log(`Backup verified on S3: ${headResult.ContentLength} bytes`);
    
    return {
      verified: true,
      size: headResult.ContentLength,
      etag: headResult.ETag,
      lastModified: headResult.LastModified,
    };
  } catch (error) {
    console.error(`Error verifying backup:`, error.message);
    throw new Error(`Backup verification failed: ${error.message}`);
  }
}

/**
 * Cleanup temporary files
 */
async function cleanupTempFiles(...filePaths) {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error cleaning up ${filePath}:`, error.message);
    }
  }
}

/**
 * Generate backup report
 */
async function generateBackupReport(backup) {
  const report = {
    id: `report-${backup.id}`,
    backupId: backup.id,
    type: backup.type,
    status: backup.status,
    startTime: backup.startedAt,
    endTime: backup.completedAt,
    duration: backup.completedAt && backup.startedAt 
      ? new Date(backup.completedAt).getTime() - new Date(backup.startedAt).getTime()
      : null,
    size: backup.size,
    checksum: backup.checksum,
    location: backup.location,
    steps: backup.steps,
    progress: backup.progress,
    error: backup.error,
    summary: {
      totalSteps: backup.steps.length,
      completedSteps: backup.steps.filter(s => s.status === 'COMPLETED').length,
      successRate: backup.steps.length > 0 
        ? ((backup.steps.filter(s => s.status === 'COMPLETED').length / backup.steps.length) * 100).toFixed(2) + '%'
        : '0%',
    },
    retention: {
      retentionDays: backup.retentionDays,
      expiresAt: backup.expiresAt,
      daysRemaining: Math.ceil((new Date(backup.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    },
    createdAt: new Date().toISOString(),
  };

  backupReports.set(report.id, report);
  
  // Log summary
  console.log(`Backup Report Generated:
    ID: ${report.id}
    Status: ${report.status}
    Duration: ${report.duration}ms
    Size: ${formatBytes(report.size)}
    Success Rate: ${report.summary.successRate}`);
  
  return report;
}

/**
 * Get backup by ID
 */
async function getBackup(backupId) {
  return backups.get(backupId) || null;
}

/**
 * Get all backups with optional filters
 */
async function getBackups(filters = {}) {
  let backupList = Array.from(backups.values());
  
  if (filters.status) {
    backupList = backupList.filter(b => b.status === filters.status);
  }
  if (filters.type) {
    backupList = backupList.filter(b => b.type === filters.type);
  }
  
  backupList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return backupList;
}

/**
 * Apply retention policy - delete expired backups
 */
async function applyRetentionPolicy() {
  const now = new Date();
  const deletedBackups = [];
  
  for (const [backupId, backup] of backups.entries()) {
    const expiryDate = new Date(backup.expiresAt);
    
    if (expiryDate <= now) {
      try {
        // In production, delete from S3
        backups.delete(backupId);
        deletedBackups.push(backupId);
        console.log(`Deleted expired backup: ${backupId}`);
      } catch (error) {
        console.error(`Error deleting backup ${backupId}:`, error.message);
      }
    }
  }
  
  return {
    deletedCount: deletedBackups.length,
    deletedBackups,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Restore from backup
 */
async function restoreFromBackup(backupId, restorePath) {
  const backup = backups.get(backupId);
  
  if (!backup) {
    throw new Error(`Backup ${backupId} not found`);
  }
  
  if (backup.status !== BACKUP_STATUS.VERIFIED) {
    throw new Error(`Cannot restore from unverified backup (status: ${backup.status})`);
  }

  const restore = {
    id: `restore-${Date.now()}`,
    backupId,
    status: 'IN_PROGRESS',
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    steps: [],
  };

  try {
    // Step 1: Download from S3
    restore.steps.push({ step: 'DOWNLOAD_S3', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    
    const tempFilePath = path.join(process.env.BACKUP_TEMP_DIR || '/tmp', `restore-${restore.id}.tar.gz`);
    const s3Key = backup.location.split('/').slice(-2).join('/');
    const bucketName = process.env.AWS_BACKUP_BUCKET || 'backup-bucket';
    
    await new Promise((resolve, reject) => {
      const file = createWriteStream(tempFilePath);
      const stream = s3.getObject({
        Bucket: bucketName,
        Key: s3Key,
      }).createReadStream();
      
      stream.on('error', reject);
      file.on('error', reject);
      file.on('finish', resolve);
      
      stream.pipe(file);
    });
    
    restore.steps[restore.steps.length - 1].status = 'COMPLETED';

    // Step 2: Decompress
    restore.steps.push({ step: 'DECOMPRESS', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    
    const extractPath = path.join(process.env.BACKUP_TEMP_DIR || '/tmp', `restore-${restore.id}-extracted`);
    
    await new Promise((resolve, reject) => {
      if (!fs.existsSync(extractPath)) {
        fs.mkdirSync(extractPath, { recursive: true });
      }
      
      const extract = require('extract-zip');
      extract(tempFilePath, { dir: extractPath })
        .then(resolve)
        .catch(reject);
    });
    
    restore.steps[restore.steps.length - 1].status = 'COMPLETED';

    // Step 3: Verify checksum
    restore.steps.push({ step: 'VERIFY_CHECKSUM', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    
    const downloadedChecksum = await calculateChecksum(tempFilePath);
    if (downloadedChecksum !== backup.checksum) {
      throw new Error(`Checksum mismatch: ${downloadedChecksum} !== ${backup.checksum}`);
    }
    
    restore.steps[restore.steps.length - 1].status = 'COMPLETED';

    // Step 4: Restore data
    restore.steps.push({ step: 'RESTORE_DATA', status: 'IN_PROGRESS', timestamp: new Date().toISOString() });
    
    if (fs.existsSync(restorePath)) {
      fs.rmSync(restorePath, { recursive: true, force: true });
    }
    fs.cpSync(extractPath, restorePath, { recursive: true });
    
    restore.steps[restore.steps.length - 1].status = 'COMPLETED';

    restore.status = 'COMPLETED';
    restore.completedAt = new Date().toISOString();
    
    // Cleanup temp files
    await cleanupTempFiles(tempFilePath, extractPath);

    return restore;
  } catch (error) {
    restore.status = 'FAILED';
    restore.error = error.message;
    restore.completedAt = new Date().toISOString();
    restore.steps.push({ step: 'ERROR', status: 'FAILED', error: error.message, timestamp: new Date().toISOString() });
    throw error;
  }
}

/**
 * Get backup reports
 */
async function getBackupReports(filters = {}) {
  let reports = Array.from(backupReports.values());
  
  if (filters.backupId) {
    reports = reports.filter(r => r.backupId === filters.backupId);
  }
  if (filters.status) {
    reports = reports.filter(r => r.status === filters.status);
  }
  
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return reports;
}

/**
 * Get specific backup report
 */
async function getBackupReport(reportId) {
  return backupReports.get(reportId) || null;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get backup statistics
 */
async function getBackupStats() {
  const allBackups = Array.from(backups.values());
  const totalSize = allBackups.reduce((sum, b) => sum + b.size, 0);
  
  return {
    totalBackups: allBackups.length,
    byStatus: {
      VERIFIED: allBackups.filter(b => b.status === BACKUP_STATUS.VERIFIED).length,
      FAILED: allBackups.filter(b => b.status === BACKUP_STATUS.FAILED).length,
      IN_PROGRESS: allBackups.filter(b => b.status === BACKUP_STATUS.IN_PROGRESS).length,
      PENDING: allBackups.filter(b => b.status === BACKUP_STATUS.PENDING).length,
    },
    byType: {
      FULL: allBackups.filter(b => b.type === BACKUP_TYPES.FULL).length,
      INCREMENTAL: allBackups.filter(b => b.type === BACKUP_TYPES.INCREMENTAL).length,
      DIFFERENTIAL: allBackups.filter(b => b.type === BACKUP_TYPES.DIFFERENTIAL).length,
    },
    totalSize: formatBytes(totalSize),
    oldestBackup: allBackups.length > 0 ? new Date(allBackups[allBackups.length - 1].createdAt) : null,
    newestBackup: allBackups.length > 0 ? new Date(allBackups[0].createdAt) : null,
  };
}

module.exports = {
  BACKUP_STATUS,
  BACKUP_TYPES,
  createBackup,
  executeBackup,
  getBackup,
  getBackups,
  applyRetentionPolicy,
  restoreFromBackup,
  getBackupReports,
  getBackupReport,
  getBackupStats,
};