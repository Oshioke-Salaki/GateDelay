const express = require('express');
const router = express.Router();
const releaseService = require('../services/releaseService');

module.exports = (auth) => {
  router.post('/', auth.middleware, async (req, res) => {
    try {
      const release = releaseService.createRelease(req.body);
      res.status(201).json(release);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/', auth.middleware, async (req, res) => {
    try {
      const { status } = req.query;
      const releases = releaseService.getAllReleases(status);
      res.json({ releases });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/latest', async (req, res) => {
    try {
      const { environment } = req.query;
      const release = releaseService.getLatestRelease(environment);
      if (!release) {
        return res.status(404).json({ error: 'No release found' });
      }
      res.json(release);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/scheduled', auth.middleware, async (req, res) => {
    try {
      const scheduled = releaseService.getScheduledReleases();
      res.json({ scheduled });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/version/:version', auth.middleware, async (req, res) => {
    try {
      const release = releaseService.getReleaseByVersion(req.params.version);
      if (!release) {
        return res.status(404).json({ error: 'Release not found' });
      }
      res.json(release);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', auth.middleware, async (req, res) => {
    try {
      const release = releaseService.getRelease(req.params.id);
      if (!release) {
        return res.status(404).json({ error: 'Release not found' });
      }
      res.json(release);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/:id', auth.middleware, async (req, res) => {
    try {
      const release = releaseService.updateRelease(req.params.id, req.body);
      res.json(release);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/:id', auth.middleware, async (req, res) => {
    try {
      const deleted = releaseService.deleteRelease(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: 'Release not found' });
      }
      res.json({ message: 'Release deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/schedule', auth.middleware, async (req, res) => {
    try {
      const { scheduledDate } = req.body;
      const release = releaseService.scheduleRelease(req.params.id, scheduledDate);
      res.json(release);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/notes', auth.middleware, async (req, res) => {
    try {
      const notes = releaseService.addReleaseNotes(req.params.id, req.body);
      res.status(201).json(notes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/notes', auth.middleware, async (req, res) => {
    try {
      const notes = releaseService.getReleaseNotes(req.params.id);
      if (!notes) {
        return res.status(404).json({ error: 'Release notes not found' });
      }
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/notes/markdown', auth.middleware, async (req, res) => {
    try {
      const markdown = releaseService.generateReleaseNotesMarkdown(req.params.id);
      if (!markdown) {
        return res.status(404).json({ error: 'Release notes not found' });
      }
      res.type('text/markdown').send(markdown);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/deploy', auth.middleware, async (req, res) => {
    try {
      const { environment } = req.body;
      const deployment = await releaseService.deployRelease(req.params.id, environment);
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/status', auth.middleware, async (req, res) => {
    try {
      const status = releaseService.getReleaseStatus(req.params.id);
      if (!status) {
        return res.status(404).json({ error: 'Release not found' });
      }
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/deployments', auth.middleware, async (req, res) => {
    try {
      const deployments = releaseService.getReleaseDeployments(req.params.id);
      res.json({ deployments });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/deployment/:deploymentId/rollback', auth.middleware, async (req, res) => {
    try {
      const rollback = await releaseService.rollbackDeployment(req.params.deploymentId);
      res.json(rollback);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/deployment/:deploymentId', auth.middleware, async (req, res) => {
    try {
      const deployment = releaseService.getDeploymentStatus(req.params.deploymentId);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      res.json(deployment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/webhook/notify', auth.middleware, async (req, res) => {
    try {
      const { url, releaseId } = req.body;
      const release = releaseService.getRelease(releaseId);
      if (!release) {
        return res.status(404).json({ error: 'Release not found' });
      }
      const notified = await releaseService.notifyWebhook(url, release);
      res.json({ notified });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/version/next/:currentVersion', auth.middleware, async (req, res) => {
    try {
      const { type } = req.query;
      const nextVersion = releaseService.getNextVersion(req.params.currentVersion, type);
      res.json({ currentVersion: req.params.currentVersion, nextVersion, type });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/version/compare', auth.middleware, async (req, res) => {
    try {
      const { version1, version2 } = req.body;
      const comparison = releaseService.compareVersions(version1, version2);
      res.json({ version1, version2, comparison });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
