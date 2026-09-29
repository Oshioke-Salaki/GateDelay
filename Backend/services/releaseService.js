const semver = require('semver');
const axios = require('axios');

class ReleaseService {
  constructor() {
    this.releases = new Map();
    this.scheduledReleases = new Map();
    this.releaseNotes = new Map();
    this.deploymentStatus = new Map();
  }

  createRelease(config) {
    const {
      version,
      type = 'patch',
      description,
      scheduledFor,
      environments = ['development']
    } = config;

    if (!semver.valid(version)) {
      throw new Error('Invalid semantic version');
    }

    const release = {
      id: this.generateReleaseId(),
      version,
      type,
      description,
      status: 'draft',
      environments,
      createdAt: new Date(),
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      createdBy: config.createdBy || 'system'
    };

    this.releases.set(release.id, release);
    return release;
  }

  generateReleaseId() {
    return `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getRelease(releaseId) {
    return this.releases.get(releaseId);
  }

  getAllReleases(status = null) {
    const releases = Array.from(this.releases.values());
    if (status) {
      return releases.filter(r => r.status === status);
    }
    return releases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getReleaseByVersion(version) {
    return Array.from(this.releases.values()).find(r => r.version === version);
  }

  getNextVersion(currentVersion, type = 'patch') {
    if (!semver.valid(currentVersion)) {
      currentVersion = '0.0.0';
    }
    return semver.inc(currentVersion, type);
  }

  updateRelease(releaseId, updates) {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    const updatedRelease = {
      ...release,
      ...updates,
      updatedAt: new Date()
    };

    this.releases.set(releaseId, updatedRelease);
    return updatedRelease;
  }

  deleteRelease(releaseId) {
    this.releaseNotes.delete(releaseId);
    this.scheduledReleases.delete(releaseId);
    this.deploymentStatus.delete(releaseId);
    return this.releases.delete(releaseId);
  }

  scheduleRelease(releaseId, scheduledDate) {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    const scheduledFor = new Date(scheduledDate);
    if (scheduledFor <= new Date()) {
      throw new Error('Scheduled date must be in the future');
    }

    release.scheduledFor = scheduledFor;
    release.status = 'scheduled';

    this.scheduledReleases.set(releaseId, {
      releaseId,
      scheduledFor,
      status: 'pending',
      createdAt: new Date()
    });

    this.releases.set(releaseId, release);
    return release;
  }

  getScheduledReleases() {
    const now = new Date();
    const scheduled = [];

    for (const [releaseId, schedule] of this.scheduledReleases) {
      const release = this.releases.get(releaseId);
      if (release && schedule.scheduledFor > now) {
        scheduled.push({
          ...release,
          schedule
        });
      }
    }

    return scheduled.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  }

  checkDueScheduledReleases() {
    const now = new Date();
    const dueReleases = [];

    for (const [releaseId, schedule] of this.scheduledReleases) {
      if (schedule.scheduledFor <= now && schedule.status === 'pending') {
        const release = this.releases.get(releaseId);
        if (release) {
          dueReleases.push(release);
        }
      }
    }

    return dueReleases;
  }

  addReleaseNotes(releaseId, notes) {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    const releaseNote = {
      releaseId,
      version: release.version,
      notes: notes.notes || [],
      features: notes.features || [],
      fixes: notes.fixes || [],
      breakingChanges: notes.breakingChanges || [],
      author: notes.author || 'system',
      createdAt: new Date()
    };

    this.releaseNotes.set(releaseId, releaseNote);
    return releaseNote;
  }

  getReleaseNotes(releaseId) {
    return this.releaseNotes.get(releaseId);
  }

  getAllReleaseNotes() {
    return Array.from(this.releaseNotes.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  generateReleaseNotesMarkdown(releaseId) {
    const notes = this.releaseNotes.get(releaseId);
    const release = this.releases.get(releaseId);

    if (!notes || !release) {
      return null;
    }

    let markdown = `# Release ${release.version}\n\n`;
    markdown += `**Released:** ${release.createdAt.toISOString()}\n`;
    markdown += `**Type:** ${release.type}\n\n`;

    if (release.description) {
      markdown += `## Description\n${release.description}\n\n`;
    }

    if (notes.features && notes.features.length > 0) {
      markdown += `## Features\n`;
      notes.features.forEach(feature => {
        markdown += `- ${feature}\n`;
      });
      markdown += `\n`;
    }

    if (notes.fixes && notes.fixes.length > 0) {
      markdown += `## Fixes\n`;
      notes.fixes.forEach(fix => {
        markdown += `- ${fix}\n`;
      });
      markdown += `\n`;
    }

    if (notes.breakingChanges && notes.breakingChanges.length > 0) {
      markdown += `## Breaking Changes\n`;
      notes.breakingChanges.forEach(change => {
        markdown += `- ${change}\n`;
      });
      markdown += `\n`;
    }

    if (notes.notes && notes.notes.length > 0) {
      markdown += `## Additional Notes\n`;
      notes.notes.forEach(note => {
        markdown += `- ${note}\n`;
      });
    }

    return markdown;
  }

  async deployRelease(releaseId, environment) {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error('Release not found');
    }

    if (!release.environments.includes(environment)) {
      throw new Error(`Release not configured for environment: ${environment}`);
    }

    const deploymentId = this.generateDeploymentId();
    const deployment = {
      deploymentId,
      releaseId,
      environment,
      status: 'in_progress',
      startedAt: new Date(),
      completedAt: null,
      logs: []
    };

    this.deploymentStatus.set(deploymentId, deployment);
    release.status = 'deploying';
    this.releases.set(releaseId, release);

    try {
      await this.executeDeployment(deployment, release);
      deployment.status = 'completed';
      deployment.completedAt = new Date();
      release.status = 'deployed';
    } catch (error) {
      deployment.status = 'failed';
      deployment.error = error.message;
      release.status = 'failed';
    }

    this.deploymentStatus.set(deploymentId, deployment);
    this.releases.set(releaseId, release);

    return deployment;
  }

  generateDeploymentId() {
    return `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async executeDeployment(deployment, release) {
    deployment.logs.push({
      timestamp: new Date(),
      message: `Starting deployment of release ${release.version} to ${deployment.environment}`
    });

    await this.simulateDeploymentSteps(deployment);

    deployment.logs.push({
      timestamp: new Date(),
      message: `Deployment completed successfully`
    });
  }

  async simulateDeploymentSteps(deployment) {
    const steps = [
      'Validating release configuration',
      'Running pre-deployment checks',
      'Building application',
      'Running tests',
      'Deploying to environment',
      'Running post-deployment checks',
      'Health check verification'
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 100));
      deployment.logs.push({
        timestamp: new Date(),
        message: `${step}...`
      });
    }
  }

  getDeploymentStatus(deploymentId) {
    return this.deploymentStatus.get(deploymentId);
  }

  getReleaseDeployments(releaseId) {
    const deployments = [];
    for (const [depId, deployment] of this.deploymentStatus) {
      if (deployment.releaseId === releaseId) {
        deployments.push(deployment);
      }
    }
    return deployments;
  }

  getReleaseStatus(releaseId) {
    const release = this.releases.get(releaseId);
    if (!release) {
      return null;
    }

    const deployments = this.getReleaseDeployments(releaseId);
    const schedule = this.scheduledReleases.get(releaseId);

    return {
      release: {
        id: release.id,
        version: release.version,
        status: release.status,
        type: release.type,
        createdAt: release.createdAt
      },
      schedule,
      deployments: deployments.map(d => ({
        deploymentId: d.deploymentId,
        environment: d.environment,
        status: d.status,
        startedAt: d.startedAt,
        completedAt: d.completedAt
      })),
      notes: this.releaseNotes.get(releaseId)
    };
  }

  async rollbackDeployment(deploymentId) {
    const deployment = this.deploymentStatus.get(deploymentId);
    if (!deployment) {
      throw new Error('Deployment not found');
    }

    if (deployment.status !== 'completed') {
      throw new Error('Can only rollback completed deployments');
    }

    const rollbackId = this.generateDeploymentId();
    const rollback = {
      deploymentId: rollbackId,
      releaseId: deployment.releaseId,
      environment: deployment.environment,
      status: 'rolling_back',
      startedAt: new Date(),
      isRollback: true,
      originalDeploymentId: deploymentId
    };

    this.deploymentStatus.set(rollbackId, rollback);

    try {
      await this.executeRollback(rollback);
      rollback.status = 'completed';
      rollback.completedAt = new Date();
    } catch (error) {
      rollback.status = 'failed';
      rollback.error = error.message;
    }

    this.deploymentStatus.set(rollbackId, rollback);
    return rollback;
  }

  async executeRollback(rollback) {
    rollback.logs = [];
    rollback.logs.push({
      timestamp: new Date(),
      message: `Starting rollback for deployment ${rollback.originalDeploymentId}`
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    rollback.logs.push({
      timestamp: new Date(),
      message: 'Rollback completed successfully'
    });
  }

  async notifyWebhook(url, release) {
    try {
      await axios.post(url, {
        event: 'release.created',
        release: {
          id: release.id,
          version: release.version,
          type: release.type,
          status: release.status,
          createdAt: release.createdAt
        }
      });
      return true;
    } catch (error) {
      console.error('Webhook notification failed:', error.message);
      return false;
    }
  }

  getLatestRelease(environment = null) {
    const releases = this.getAllReleases('deployed');
    
    if (environment) {
      const envReleases = releases.filter(r => 
        this.getReleaseDeployments(r.id).some(d => d.environment === environment && d.status === 'completed')
      );
      return envReleases[0] || null;
    }

    return releases[0] || null;
  }

  compareVersions(version1, version2) {
    return semver.compare(version1, version2);
  }

  isValidVersion(version) {
    return semver.valid(version) !== null;
  }
}

module.exports = new ReleaseService();
