const { Dispute, DISPUTE_STATUSES, VALID_TRANSITIONS } = require('../models/Dispute');

/**
 * DISPUTE SERVICE
 * Handles all dispute lifecycle operations with secure state management
 */

/**
 * Validate dispute state transition
 * @param {string} currentStatus - Current dispute status
 * @param {string} newStatus - Desired new status
 * @returns {boolean} Whether transition is valid
 */
function isValidTransition(currentStatus, newStatus) {
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Validate input data for dispute creation
 * @param {object} data - Dispute data to validate
 * @throws {Error} If validation fails
 */
function validateDisputeInput(data) {
  if (!data.marketId || typeof data.marketId !== 'string') {
    throw new Error('Invalid or missing marketId');
  }
  if (!data.userId || typeof data.userId !== 'string') {
    throw new Error('Invalid or missing userId');
  }
  if (!data.reason || typeof data.reason !== 'string') {
    throw new Error('Invalid or missing reason');
  }
  if (!data.description || typeof data.description !== 'string') {
    throw new Error('Invalid or missing description');
  }
  if (data.description.trim().length < 10) {
    throw new Error('Description must be at least 10 characters');
  }
}

/**
 * A. CREATE DISPUTE
 * Initiates a new dispute with validation
 *
 * @param {object} data - Dispute creation data
 * @param {string} data.marketId - Associated market ID
 * @param {string} data.userId - User filing the dispute
 * @param {string} data.reason - Dispute reason/category
 * @param {string} data.description - Detailed description
 * @returns {Promise<object>} Created dispute document
 * @throws {Error} If validation fails or duplicate active dispute exists
 */
async function createDispute(data) {
  try {
    // Validate inputs
    validateDisputeInput(data);

    // Check for duplicate active disputes (same market + user + active status)
    const existingDispute = await Dispute.findOne({
      marketId: data.marketId,
      userId: data.userId,
      status: { $in: [DISPUTE_STATUSES.OPEN, DISPUTE_STATUSES.UNDER_REVIEW] },
    });

    if (existingDispute) {
      throw new Error(
        `Active dispute already exists for this market/user pair. Dispute ID: ${existingDispute._id}`
      );
    }

    // Create new dispute with OPEN status
    const dispute = new Dispute({
      marketId: data.marketId,
      userId: data.userId,
      reason: data.reason.trim(),
      description: data.description.trim(),
      status: DISPUTE_STATUSES.OPEN,
      evidence: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await dispute.save();

    return {
      success: true,
      data: dispute,
      message: 'Dispute created successfully',
    };
  } catch (error) {
    throw new Error(`Failed to create dispute: ${error.message}`);
  }
}

/**
 * B. ADD EVIDENCE
 * Attaches evidence to dispute with authorization checks
 *
 * @param {string} disputeId - Dispute ID
 * @param {string} userId - User adding evidence (must be involved party)
 * @param {object} evidence - Evidence data
 * @param {string} evidence.url - IPFS/CDN URL (no raw file content)
 * @param {string} evidence.description - Evidence description
 * @returns {Promise<object>} Updated dispute with evidence
 * @throws {Error} If not authorized or evidence invalid
 */
async function addEvidence(disputeId, userId, evidence) {
  try {
    // Validate evidence input
    if (!evidence || !evidence.url || typeof evidence.url !== 'string') {
      throw new Error('Invalid or missing evidence URL');
    }
    if (!evidence.description || typeof evidence.description !== 'string') {
      throw new Error('Invalid or missing evidence description');
    }

    // Fetch dispute
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Authorization: only involved parties (userId who created dispute) can add evidence
    if (dispute.userId !== userId) {
      throw new Error('Unauthorized: Only involved parties can add evidence');
    }

    // Check dispute status - can only add evidence if OPEN or UNDER_REVIEW
    if (
      ![DISPUTE_STATUSES.OPEN, DISPUTE_STATUSES.UNDER_REVIEW].includes(
        dispute.status
      )
    ) {
      throw new Error(
        `Cannot add evidence to ${dispute.status} dispute. Only OPEN and UNDER_REVIEW disputes accept evidence.`
      );
    }

    // Create evidence entry
    const newEvidence = {
      url: evidence.url.trim(),
      uploadedBy: userId,
      description: evidence.description.trim(),
      timestamp: new Date(),
    };

    // Add to evidence array
    dispute.evidence.push(newEvidence);
    dispute.updatedAt = new Date();

    await dispute.save();

    return {
      success: true,
      data: dispute,
      message: 'Evidence added successfully',
    };
  } catch (error) {
    throw new Error(`Failed to add evidence: ${error.message}`);
  }
}

/**
 * C. START REVIEW
 * Moves dispute from OPEN to UNDER_REVIEW (admin only)
 *
 * @param {string} disputeId - Dispute ID
 * @param {string} adminId - Admin/Moderator ID
 * @returns {Promise<object>} Updated dispute
 * @throws {Error} If invalid state transition or unauthorized
 */
async function startReview(disputeId, adminId) {
  try {
    if (!adminId || typeof adminId !== 'string') {
      throw new Error('Invalid admin ID');
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Validate state transition
    if (!isValidTransition(dispute.status, DISPUTE_STATUSES.UNDER_REVIEW)) {
      throw new Error(
        `Invalid state transition from ${dispute.status} to UNDER_REVIEW`
      );
    }

    dispute.status = DISPUTE_STATUSES.UNDER_REVIEW;
    dispute.reviewStartedAt = new Date();
    dispute.updatedAt = new Date();

    await dispute.save();

    return {
      success: true,
      data: dispute,
      message: 'Dispute moved to UNDER_REVIEW',
    };
  } catch (error) {
    throw new Error(`Failed to start review: ${error.message}`);
  }
}

/**
 * D. RESOLVE DISPUTE
 * Finalizes dispute with resolution details (admin only)
 *
 * @param {string} disputeId - Dispute ID
 * @param {object} resolutionData - Resolution information
 * @param {string} resolutionData.adminId - Admin/Moderator ID
 * @param {string} resolutionData.outcome - Resolution outcome (USER_WIN, ADMIN_WIN, SYSTEM_DECISION, REJECTED)
 * @param {string} resolutionData.summary - Decision explanation
 * @param {string} [resolutionData.txHash] - Optional blockchain transaction hash
 * @returns {Promise<object>} Resolved dispute
 * @throws {Error} If invalid state or missing required data
 */
async function resolveDispute(disputeId, resolutionData) {
  try {
    // Validate resolution data
    if (!resolutionData || !resolutionData.adminId) {
      throw new Error('Missing or invalid adminId');
    }
    if (!resolutionData.outcome) {
      throw new Error('Missing or invalid outcome');
    }
    if (!resolutionData.summary) {
      throw new Error('Missing or invalid summary');
    }

    const validOutcomes = [
      'USER_WIN',
      'ADMIN_WIN',
      'SYSTEM_DECISION',
      'REJECTED',
    ];
    if (!validOutcomes.includes(resolutionData.outcome)) {
      throw new Error(
        `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}`
      );
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Validate state transition
    if (!isValidTransition(dispute.status, DISPUTE_STATUSES.RESOLVED)) {
      throw new Error(
        `Invalid state transition from ${dispute.status} to RESOLVED. Dispute must be UNDER_REVIEW.`
      );
    }

    // Create resolution record
    dispute.resolution = {
      outcome: resolutionData.outcome,
      decidedBy: resolutionData.adminId,
      summary: resolutionData.summary.trim(),
      txHash: resolutionData.txHash || null,
      decidedAt: new Date(),
    };

    dispute.status = DISPUTE_STATUSES.RESOLVED;
    dispute.resolvedAt = new Date();
    dispute.updatedAt = new Date();

    await dispute.save();

    return {
      success: true,
      data: dispute,
      message: 'Dispute resolved successfully',
    };
  } catch (error) {
    throw new Error(`Failed to resolve dispute: ${error.message}`);
  }
}

/**
 * E. REJECT DISPUTE
 * Rejects dispute with reason (admin only)
 *
 * @param {string} disputeId - Dispute ID
 * @param {string} adminId - Admin/Moderator ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<object>} Rejected dispute
 * @throws {Error} If invalid state or authorization
 */
async function rejectDispute(disputeId, adminId, reason) {
  try {
    if (!adminId || typeof adminId !== 'string') {
      throw new Error('Invalid admin ID');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      throw new Error('Invalid or missing rejection reason');
    }

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Can reject from OPEN or UNDER_REVIEW
    if (
      ![DISPUTE_STATUSES.OPEN, DISPUTE_STATUSES.UNDER_REVIEW].includes(
        dispute.status
      )
    ) {
      throw new Error(
        `Cannot reject a ${dispute.status} dispute. Only OPEN and UNDER_REVIEW disputes can be rejected.`
      );
    }

    // Valid transition check
    if (!isValidTransition(dispute.status, DISPUTE_STATUSES.REJECTED)) {
      throw new Error(
        `Invalid state transition from ${dispute.status} to REJECTED`
      );
    }

    dispute.status = DISPUTE_STATUSES.REJECTED;
    dispute.resolution = {
      outcome: 'REJECTED',
      decidedBy: adminId,
      summary: reason.trim(),
      txHash: null,
      decidedAt: new Date(),
    };
    dispute.updatedAt = new Date();

    await dispute.save();

    return {
      success: true,
      data: dispute,
      message: 'Dispute rejected successfully',
    };
  } catch (error) {
    throw new Error(`Failed to reject dispute: ${error.message}`);
  }
}

/**
 * GET DISPUTE
 * Retrieves single dispute by ID
 *
 * @param {string} disputeId - Dispute ID
 * @returns {Promise<object>} Dispute document
 * @throws {Error} If dispute not found
 */
async function getDispute(disputeId) {
  try {
    const dispute = await Dispute.findById(disputeId);
    if (!dispute) {
      throw new Error('Dispute not found');
    }

    return {
      success: true,
      data: dispute,
    };
  } catch (error) {
    throw new Error(`Failed to fetch dispute: ${error.message}`);
  }
}

/**
 * GET DISPUTE BY USER AND MARKET
 * Retrieves dispute for specific user/market combination
 *
 * @param {string} userId - User ID
 * @param {string} marketId - Market ID
 * @returns {Promise<object>} Dispute document (if exists)
 */
async function getDisputeByUserMarket(userId, marketId) {
  try {
    const dispute = await Dispute.findOne({
      userId,
      marketId,
    }).sort({ createdAt: -1 });

    return {
      success: true,
      data: dispute,
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch dispute: ${error.message}`
    );
  }
}

/**
 * F. TRACK OUTCOMES + ANALYTICS
 * Comprehensive dispute analytics
 *
 * @returns {Promise<object>} Analytics data
 */
async function getDisputeAnalytics() {
  try {
    // Total disputes
    const totalDisputes = await Dispute.countDocuments();

    // Count by status
    const statusCounts = await Dispute.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    // Average resolution time (only for RESOLVED and REJECTED)
    const resolutionTimes = await Dispute.aggregate([
      {
        $match: {
          status: { $in: [DISPUTE_STATUSES.RESOLVED, DISPUTE_STATUSES.REJECTED] },
          resolvedAt: { $ne: null },
        },
      },
      {
        $project: {
          resolutionTime: {
            $subtract: ['$resolvedAt', '$createdAt'],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$resolutionTime' },
          minTime: { $min: '$resolutionTime' },
          maxTime: { $max: '$resolutionTime' },
        },
      },
    ]);

    // Disputes per market
    const disputesByMarket = await Dispute.aggregate([
      {
        $group: {
          _id: '$marketId',
          count: { $sum: 1 },
          openCount: {
            $sum: {
              $cond: [{ $eq: ['$status', DISPUTE_STATUSES.OPEN] }, 1, 0],
            },
          },
          resolvedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', DISPUTE_STATUSES.RESOLVED] }, 1, 0],
            },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Win rates (outcomes for resolved disputes)
    const outcomes = await Dispute.aggregate([
      {
        $match: {
          status: DISPUTE_STATUSES.RESOLVED,
        },
      },
      {
        $group: {
          _id: '$resolution.outcome',
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate percentages
    const outcomeCounts = {};
    outcomes.forEach((o) => {
      outcomeCounts[o._id] = o.count;
    });

    const resolvedCount =
      statusCounts.find((s) => s._id === DISPUTE_STATUSES.RESOLVED)?.count || 0;
    const outcomePercentages = {};
    if (resolvedCount > 0) {
      Object.keys(outcomeCounts).forEach((outcome) => {
        outcomePercentages[outcome] = (
          (outcomeCounts[outcome] / resolvedCount) *
          100
        ).toFixed(2);
      });
    }

    // Average evidence per dispute
    const evidenceStats = await Dispute.aggregate([
      {
        $group: {
          _id: null,
          avgEvidenceCount: {
            $avg: { $size: '$evidence' },
          },
          totalEvidence: {
            $sum: { $size: '$evidence' },
          },
        },
      },
    ]);

    // Time metrics in human-readable format
    let avgResolutionTimeFormatted = 'N/A';
    if (resolutionTimes.length > 0) {
      const avgMs = resolutionTimes[0].avgTime;
      const avgDays = (avgMs / (1000 * 60 * 60 * 24)).toFixed(2);
      avgResolutionTimeFormatted = `${avgDays} days`;
    }

    return {
      success: true,
      data: {
        summary: {
          totalDisputes,
          statusBreakdown: statusCounts.reduce((acc, s) => {
            acc[s._id] = s.count;
            return acc;
          }, {}),
        },
        resolution: {
          averageResolutionTime: avgResolutionTimeFormatted,
          averageResolutionTimeMs: resolutionTimes[0]?.avgTime || null,
          minResolutionTimeMs: resolutionTimes[0]?.minTime || null,
          maxResolutionTimeMs: resolutionTimes[0]?.maxTime || null,
        },
        marketMetrics: disputesByMarket.map((m) => ({
          marketId: m._id,
          totalDisputes: m.count,
          openDisputes: m.openCount,
          resolvedDisputes: m.resolvedCount,
        })),
        outcomes: {
          counts: outcomeCounts,
          percentages: outcomePercentages,
        },
        evidence: {
          averagePerDispute: (
            evidenceStats[0]?.avgEvidenceCount || 0
          ).toFixed(2),
          totalPieces: evidenceStats[0]?.totalEvidence || 0,
        },
        timestamp: new Date(),
      },
    };
  } catch (error) {
    throw new Error(`Failed to generate analytics: ${error.message}`);
  }
}

module.exports = {
  createDispute,
  addEvidence,
  startReview,
  resolveDispute,
  rejectDispute,
  getDispute,
  getDisputeByUserMarket,
  getDisputeAnalytics,
  DISPUTE_STATUSES,
  VALID_TRANSITIONS,
};
