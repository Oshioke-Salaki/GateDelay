const mongoose = require('mongoose');

const ExperimentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  status: { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'draft' },
  variants: [{
    name: String,
    description: String,
    trafficAllocation: Number,
    config: mongoose.Schema.Types.Mixed
  }],
  targetingCriteria: mongoose.Schema.Types.Mixed,
  startDate: Date,
  endDate: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const ExperimentAssignmentSchema = new mongoose.Schema({
  experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Experiment' },
  userId: String,
  variant: String,
  assignedAt: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
});

const ExperimentMetricSchema = new mongoose.Schema({
  experimentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Experiment' },
  variant: String,
  metricName: String,
  metricValue: Number,
  timestamp: { type: Date, default: Date.now },
  userId: String
});

const Experiment = mongoose.model('Experiment', ExperimentSchema);
const ExperimentAssignment = mongoose.model('ExperimentAssignment', ExperimentAssignmentSchema);
const ExperimentMetric = mongoose.model('ExperimentMetric', ExperimentMetricSchema);

class ABTestingService {
  async createExperiment(config) {
    const totalAllocation = config.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error('Variant traffic allocations must sum to 100');
    }

    const experiment = new Experiment({
      name: config.name,
      description: config.description,
      variants: config.variants,
      targetingCriteria: config.targetingCriteria || {},
      startDate: config.startDate,
      endDate: config.endDate
    });

    await experiment.save();
    return experiment;
  }

  async getExperiment(experimentId) {
    return Experiment.findById(experimentId);
  }

  async getExperimentByName(name) {
    return Experiment.findOne({ name });
  }

  async getAllExperiments(status = null) {
    const query = status ? { status } : {};
    return Experiment.find(query);
  }

  async updateExperiment(experimentId, updates) {
    return Experiment.findByIdAndUpdate(experimentId, updates, { new: true });
  }

  async deleteExperiment(experimentId) {
    await ExperimentAssignment.deleteMany({ experimentId });
    await ExperimentMetric.deleteMany({ experimentId });
    return Experiment.findByIdAndDelete(experimentId);
  }

  async startExperiment(experimentId) {
    return this.updateExperiment(experimentId, { status: 'active', startDate: new Date() });
  }

  async pauseExperiment(experimentId) {
    return this.updateExperiment(experimentId, { status: 'paused' });
  }

  async completeExperiment(experimentId) {
    return this.updateExperiment(experimentId, { status: 'completed', endDate: new Date() });
  }

  async assignUser(experimentId, user) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment || experiment.status !== 'active') {
      throw new Error('Experiment not found or not active');
    }

    if (!this.matchesTargeting(user, experiment.targetingCriteria)) {
      return null;
    }

    const existingAssignment = await ExperimentAssignment.findOne({
      experimentId,
      userId: user.id
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    const variant = this.selectVariant(experiment.variants, user);

    const assignment = new ExperimentAssignment({
      experimentId,
      userId: user.id,
      variant: variant.name,
      metadata: {
        userAgent: user.userAgent,
        ip: user.ip
      }
    });

    await assignment.save();
    return assignment;
  }

  selectVariant(variants, user) {
    const hash = this.hashUser(user.id);
    const bucket = hash % 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.trafficAllocation;
      if (bucket < cumulative) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  hashUser(userId) {
    let hash = 0;
    const str = String(userId);
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  matchesTargeting(user, criteria) {
    if (!criteria || Object.keys(criteria).length === 0) {
      return true;
    }

    for (const [key, value] of Object.entries(criteria)) {
      if (user[key] !== value) {
        return false;
      }
    }

    return true;
  }

  async trackMetric(experimentId, userId, metricName, metricValue) {
    const assignment = await ExperimentAssignment.findOne({
      experimentId,
      userId
    });

    if (!assignment) {
      throw new Error('User not assigned to this experiment');
    }

    const metric = new ExperimentMetric({
      experimentId,
      variant: assignment.variant,
      metricName,
      metricValue,
      userId
    });

    await metric.save();
    return metric;
  }

  async getExperimentResults(experimentId) {
    const experiment = await this.getExperiment(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const assignments = await ExperimentAssignment.find({ experimentId });
    const metrics = await ExperimentMetric.find({ experimentId });

    const results = {
      experiment: experiment.name,
      status: experiment.status,
      totalParticipants: assignments.length,
      variants: [],
      statisticalAnalysis: null
    };

    const variantStats = {};

    for (const variant of experiment.variants) {
      variantStats[variant.name] = {
        name: variant.name,
        participants: 0,
        metrics: {}
      };
    }

    assignments.forEach(a => {
      if (variantStats[a.variant]) {
        variantStats[a.variant].participants++;
      }
    });

    metrics.forEach(m => {
      if (variantStats[m.variant]) {
        if (!variantStats[m.variant].metrics[m.metricName]) {
          variantStats[m.variant].metrics[m.metricName] = {
            count: 0,
            sum: 0,
            values: []
          };
        }
        variantStats[m.variant].metrics[m.metricName].count++;
        variantStats[m.variant].metrics[m.metricName].sum += m.metricValue;
        variantStats[m.variant].metrics[m.metricName].values.push(m.metricValue);
      }
    });

    for (const variant of experiment.variants) {
      const stats = variantStats[variant.name];
      const variantResult = {
        name: variant.name,
        participants: stats.participants,
        metrics: {}
      };

      for (const [metricName, data] of Object.entries(stats.metrics)) {
        const mean = data.sum / data.count;
        const variance = data.values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.count;
        const stdDev = Math.sqrt(variance);

        variantResult.metrics[metricName] = {
          count: data.count,
          mean: mean,
          stdDev: stdDev,
          min: Math.min(...data.values),
          max: Math.max(...data.values)
        };
      }

      results.variants.push(variantResult);
    }

    results.statisticalAnalysis = this.performStatisticalAnalysis(results.variants);

    return results;
  }

  performStatisticalAnalysis(variants) {
    if (variants.length < 2) {
      return null;
    }

    const analysis = {
      comparisons: [],
      winner: null
    };

    const control = variants[0];
    let bestVariant = control;
    let bestImprovement = 0;

    for (let i = 1; i < variants.length; i++) {
      const treatment = variants[i];
      const comparison = this.compareVariants(control, treatment);
      analysis.comparisons.push(comparison);

      if (comparison.significant && comparison.improvement > bestImprovement) {
        bestImprovement = comparison.improvement;
        bestVariant = treatment;
      }
    }

    analysis.winner = bestVariant.name;
    return analysis;
  }

  compareVariants(control, treatment) {
    const comparisons = [];

    for (const [metricName, controlMetric] of Object.entries(control.metrics)) {
      const treatmentMetric = treatment.metrics[metricName];
      if (!treatmentMetric) continue;

      const improvement = ((treatmentMetric.mean - controlMetric.mean) / controlMetric.mean) * 100;
      const pooledStdDev = Math.sqrt(
        (Math.pow(controlMetric.stdDev, 2) + Math.pow(treatmentMetric.stdDev, 2)) / 2
      );
      const standardError = pooledStdDev * Math.sqrt(1 / controlMetric.count + 1 / treatmentMetric.count);
      const zScore = (treatmentMetric.mean - controlMetric.mean) / standardError;
      const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
      const significant = pValue < 0.05;

      comparisons.push({
        metric: metricName,
        controlMean: controlMetric.mean,
        treatmentMean: treatmentMetric.mean,
        improvement: improvement.toFixed(2),
        pValue: pValue.toFixed(4),
        significant
      });
    }

    return {
      variant: treatment.name,
      comparisons,
      significant: comparisons.some(c => c.significant),
      improvement: parseFloat(comparisons[0]?.improvement || 0)
    };
  }

  normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x >= 0 ? 1 - prob : prob;
  }

  async getUserAssignments(userId) {
    return ExperimentAssignment.find({ userId }).populate('experimentId');
  }
}

module.exports = new ABTestingService();
