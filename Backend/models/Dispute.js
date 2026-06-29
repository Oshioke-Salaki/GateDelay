const mongoose = require('mongoose');

// Define dispute statuses
const DISPUTE_STATUSES = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
};

// Define valid status transitions
const VALID_TRANSITIONS = {
  OPEN: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};

const EvidenceSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    description: 'IPFS or CDN URL - no raw files stored in DB',
  },
  uploadedBy: {
    type: String,
    required: true,
    description: 'User ID of evidence uploader',
  },
  description: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ResolutionSchema = new mongoose.Schema({
  outcome: {
    type: String,
    enum: ['USER_WIN', 'ADMIN_WIN', 'SYSTEM_DECISION', 'REJECTED'],
    description: 'Resolution outcome',
  },
  decidedBy: {
    type: String,
    description: 'Admin/Moderator ID that made the decision',
  },
  summary: {
    type: String,
    description: 'Plain text explanation of the decision',
  },
  txHash: {
    type: String,
    default: null,
    description: 'Optional blockchain transaction hash for logging',
  },
  decidedAt: {
    type: Date,
    default: Date.now,
  },
});

const DisputeSchema = new mongoose.Schema(
  {
    marketId: {
      type: String,
      required: true,
      index: true,
      description: 'Associated marketplace ID',
    },
    userId: {
      type: String,
      required: true,
      index: true,
      description: 'User who filed the dispute',
    },
    status: {
      type: String,
      enum: Object.values(DISPUTE_STATUSES),
      default: DISPUTE_STATUSES.OPEN,
      index: true,
      description: 'Current dispute status',
    },
    reason: {
      type: String,
      required: true,
      description: 'Category/reason for dispute',
    },
    description: {
      type: String,
      required: true,
      description: 'Detailed description of the dispute',
    },
    evidence: [EvidenceSchema],
    resolution: ResolutionSchema,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    reviewStartedAt: {
      type: Date,
      default: null,
      description: 'Timestamp when dispute moved to UNDER_REVIEW',
    },
    resolvedAt: {
      type: Date,
      default: null,
      description: 'Timestamp when dispute was resolved',
    },
  },
  { timestamps: true }
);

// Create compound index for finding active disputes per market/user
DisputeSchema.index({ marketId: 1, userId: 1, status: 1 });

// Index for analytics queries
DisputeSchema.index({ status: 1, createdAt: 1 });
DisputeSchema.index({ marketId: 1, status: 1 });

module.exports = {
  Dispute: mongoose.models.Dispute || mongoose.model('Dispute', DisputeSchema),
  DISPUTE_STATUSES,
  VALID_TRANSITIONS,
};
