const mongoose = require('mongoose');
const Big = require('big.js');

/**
 * INSURANCE SERVICE
 * Handles market insurance coverage: quotes, purchases, premium calculation,
 * coverage tracking, and claim initiation.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const COVERAGE_STATUSES = {
  ACTIVE:    'ACTIVE',
  EXPIRED:   'EXPIRED',
  CANCELLED: 'CANCELLED',
  CLAIMED:   'CLAIMED',
};

const COVERAGE_TIERS = {
  BASIC:    { label: 'BASIC',    maxCoverage: '10000',  baseRate: '0.02' },  // 2% premium
  STANDARD: { label: 'STANDARD', maxCoverage: '50000',  baseRate: '0.015' }, // 1.5%
  PREMIUM:  { label: 'PREMIUM',  maxCoverage: '250000', baseRate: '0.01' },  // 1%
};

const COVERAGE_DURATION_DAYS = [30, 60, 90, 180, 365];

// ─── Schemas ──────────────────────────────────────────────────────────────────

const insurancePolicySchema = new mongoose.Schema({
  userId:          { type: String, required: true, index: true },
  marketId:        { type: String, required: true, index: true },
  tier:            { type: String, enum: Object.keys(COVERAGE_TIERS), required: true },
  coverageAmount:  { type: String, required: true },   // max payout in base asset
  premiumAmount:   { type: String, required: true },   // premium paid
  asset:           { type: String, required: true },   // e.g. 'USDC'
  status:          { type: String, enum: Object.values(COVERAGE_STATUSES), default: COVERAGE_STATUSES.ACTIVE },
  startDate:       { type: Date, required: true },
  endDate:         { type: Date, required: true },
  durationDays:    { type: Number, required: true },
  txHash:          { type: String, default: null },
  claimId:         { type: String, default: null },
  cancelledAt:     { type: Date, default: null },
  cancelReason:    { type: String, default: null },
}, { timestamps: true });

const InsurancePolicy = mongoose.models.InsurancePolicy
  || mongoose.model('InsurancePolicy', insurancePolicySchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Calculate premium for given coverage parameters.
 * Premium = coverageAmount × baseRate × durationFactor
 * durationFactor = durationDays / 365
 *
 * @param {string} tier
 * @param {string} coverageAmount
 * @param {number} durationDays
 * @returns {string} premium amount (string for precision)
 */
function calculatePremium(tier, coverageAmount, durationDays) {
  const tierConfig = COVERAGE_TIERS[tier];
  if (!tierConfig) throw new Error(`Invalid tier: ${tier}`);

  const durationFactor = new Big(durationDays).div(365);
  const premium = new Big(coverageAmount)
    .times(tierConfig.baseRate)
    .times(durationFactor)
    .toFixed(8);

  return premium;
}

function assertValidTier(tier) {
  if (!COVERAGE_TIERS[tier]) {
    throw new Error(`Invalid tier: "${tier}". Valid: ${Object.keys(COVERAGE_TIERS).join(', ')}`);
  }
}

function assertValidDuration(days) {
  if (!COVERAGE_DURATION_DAYS.includes(Number(days))) {
    throw new Error(`Invalid duration. Allowed days: ${COVERAGE_DURATION_DAYS.join(', ')}`);
  }
}

function assertCoverageWithinLimit(tier, coverageAmount) {
  const max = new Big(COVERAGE_TIERS[tier].maxCoverage);
  if (new Big(coverageAmount).gt(max)) {
    throw new Error(`Coverage amount exceeds ${tier} tier maximum of ${max.toString()}`);
  }
  if (new Big(coverageAmount).lte(0)) {
    throw new Error('Coverage amount must be greater than 0');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * GENERATE QUOTE
 * Returns a premium estimate without persisting anything.
 *
 * @param {object} params
 * @param {string} params.tier
 * @param {string} params.coverageAmount
 * @param {number} params.durationDays
 * @param {string} params.asset
 * @returns {object}
 */
function generateQuote(params) {
  const { tier, coverageAmount, durationDays, asset } = params;

  if (!tier || !coverageAmount || !durationDays || !asset) {
    throw new Error('tier, coverageAmount, durationDays, and asset are required');
  }

  assertValidTier(tier);
  assertValidDuration(durationDays);
  assertCoverageWithinLimit(tier, coverageAmount);

  const premium = calculatePremium(tier, coverageAmount, durationDays);
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + Number(durationDays) * 86400000);

  return {
    success: true,
    data: {
      tier,
      coverageAmount,
      premiumAmount: premium,
      asset,
      durationDays: Number(durationDays),
      startDate,
      endDate,
      tierConfig: COVERAGE_TIERS[tier],
      quoteExpiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min validity
    },
  };
}

/**
 * PURCHASE INSURANCE
 * Creates and persists an insurance policy after validating the quote parameters.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.marketId
 * @param {string} params.tier
 * @param {string} params.coverageAmount
 * @param {number} params.durationDays
 * @param {string} params.asset
 * @param {string} [params.txHash]
 * @returns {Promise<object>}
 */
async function purchaseInsurance(params) {
  const { userId, marketId, tier, coverageAmount, durationDays, asset, txHash = null } = params;

  if (!userId || !marketId || !asset) {
    throw new Error('userId, marketId, and asset are required');
  }

  assertValidTier(tier);
  assertValidDuration(durationDays);
  assertCoverageWithinLimit(tier, coverageAmount);

  // Prevent duplicate active policy for same user+market+tier
  const existing = await InsurancePolicy.findOne({
    userId,
    marketId,
    tier,
    status: COVERAGE_STATUSES.ACTIVE,
    endDate: { $gt: new Date() },
  });
  if (existing) {
    throw new Error(`Active ${tier} policy already exists for this market. Policy ID: ${existing._id}`);
  }

  const premium = calculatePremium(tier, coverageAmount, durationDays);
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + Number(durationDays) * 86400000);

  const policy = new InsurancePolicy({
    userId,
    marketId,
    tier,
    coverageAmount,
    premiumAmount: premium,
    asset,
    status: COVERAGE_STATUSES.ACTIVE,
    startDate,
    endDate,
    durationDays: Number(durationDays),
    txHash,
  });

  await policy.save();

  return { success: true, data: policy, message: 'Insurance policy purchased successfully' };
}

/**
 * GET COVERAGE STATUS
 * Returns the current coverage status and remaining limits for a policy.
 *
 * @param {string} policyId
 * @returns {Promise<object>}
 */
async function getCoverageStatus(policyId) {
  if (!policyId) throw new Error('policyId is required');

  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw new Error('Policy not found');

  const now = new Date();
  const isExpired = policy.endDate < now;

  // Auto-expire if past end date and still ACTIVE
  if (isExpired && policy.status === COVERAGE_STATUSES.ACTIVE) {
    policy.status = COVERAGE_STATUSES.EXPIRED;
    await policy.save();
  }

  const daysRemaining = isExpired
    ? 0
    : Math.ceil((policy.endDate - now) / 86400000);

  return {
    success: true,
    data: {
      policy,
      daysRemaining,
      isActive: policy.status === COVERAGE_STATUSES.ACTIVE && !isExpired,
      coverageLimit: policy.coverageAmount,
    },
  };
}

/**
 * GET USER POLICIES
 * Returns all policies for a user, optionally filtered by status.
 *
 * @param {string} userId
 * @param {string} [status]
 * @returns {Promise<object>}
 */
async function getUserPolicies(userId, status = null) {
  if (!userId) throw new Error('userId is required');

  const query = { userId };
  if (status) {
    if (!Object.values(COVERAGE_STATUSES).includes(status)) {
      throw new Error(`Invalid status filter: ${status}`);
    }
    query.status = status;
  }

  const policies = await InsurancePolicy.find(query).sort({ createdAt: -1 });
  return { success: true, data: policies };
}

/**
 * CANCEL POLICY
 * Cancels an active policy. No refund logic here — handled externally.
 *
 * @param {string} policyId
 * @param {string} userId
 * @param {string} reason
 * @returns {Promise<object>}
 */
async function cancelPolicy(policyId, userId, reason) {
  if (!policyId || !userId || !reason) {
    throw new Error('policyId, userId, and reason are required');
  }

  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw new Error('Policy not found');
  if (policy.userId !== userId) throw new Error('Unauthorized: policy belongs to a different user');
  if (policy.status !== COVERAGE_STATUSES.ACTIVE) {
    throw new Error(`Cannot cancel a policy with status "${policy.status}"`);
  }

  policy.status = COVERAGE_STATUSES.CANCELLED;
  policy.cancelledAt = new Date();
  policy.cancelReason = reason.trim();
  await policy.save();

  return { success: true, data: policy, message: 'Policy cancelled successfully' };
}

/**
 * MARK POLICY CLAIMED
 * Called by claimService after a successful disbursement.
 *
 * @param {string} policyId
 * @param {string} claimId
 * @returns {Promise<void>}
 */
async function markPolicyClaimed(policyId, claimId) {
  await InsurancePolicy.findByIdAndUpdate(policyId, {
    status: COVERAGE_STATUSES.CLAIMED,
    claimId,
  });
}

module.exports = {
  generateQuote,
  purchaseInsurance,
  getCoverageStatus,
  getUserPolicies,
  cancelPolicy,
  markPolicyClaimed,
  calculatePremium,
  COVERAGE_STATUSES,
  COVERAGE_TIERS,
  COVERAGE_DURATION_DAYS,
  InsurancePolicy,
};
