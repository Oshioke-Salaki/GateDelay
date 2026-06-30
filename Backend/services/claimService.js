const mongoose = require('mongoose');
const crypto = require('crypto');
const Big = require('big.js');
const { InsurancePolicy, COVERAGE_STATUSES, markPolicyClaimed } = require('./insuranceService');

/**
 * CLAIM SERVICE
 * Validates eligibility, processes documentation, calculates payouts,
 * manages the approval workflow, and handles disbursements.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const CLAIM_STATUSES = {
  SUBMITTED:   'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED:    'APPROVED',
  REJECTED:    'REJECTED',
  DISBURSED:   'DISBURSED',
};

const VALID_TRANSITIONS = {
  [CLAIM_STATUSES.SUBMITTED]:    [CLAIM_STATUSES.UNDER_REVIEW, CLAIM_STATUSES.REJECTED],
  [CLAIM_STATUSES.UNDER_REVIEW]: [CLAIM_STATUSES.APPROVED, CLAIM_STATUSES.REJECTED],
  [CLAIM_STATUSES.APPROVED]:     [CLAIM_STATUSES.DISBURSED],
  [CLAIM_STATUSES.REJECTED]:     [],
  [CLAIM_STATUSES.DISBURSED]:    [],
};

const CLAIM_REJECTION_REASONS = {
  INELIGIBLE_POLICY:   'INELIGIBLE_POLICY',
  EXPIRED_POLICY:      'EXPIRED_POLICY',
  DUPLICATE_CLAIM:     'DUPLICATE_CLAIM',
  INSUFFICIENT_DOCS:   'INSUFFICIENT_DOCS',
  FRAUD_SUSPECTED:     'FRAUD_SUSPECTED',
  AMOUNT_EXCEEDS_LIMIT: 'AMOUNT_EXCEEDS_LIMIT',
  ADMIN_DECISION:      'ADMIN_DECISION',
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const claimSchema = new mongoose.Schema({
  claimRef:      { type: String, required: true, unique: true, index: true }, // human-readable ref
  policyId:      { type: String, required: true, index: true },
  userId:        { type: String, required: true, index: true },
  marketId:      { type: String, required: true },
  claimAmount:   { type: String, required: true },   // requested payout
  payoutAmount:  { type: String, default: null },    // approved payout (may differ)
  asset:         { type: String, required: true },
  description:   { type: String, required: true },
  status:        { type: String, enum: Object.values(CLAIM_STATUSES), default: CLAIM_STATUSES.SUBMITTED },
  // Documentation: array of { url, type, hash, uploadedAt }
  documents: [{
    url:        { type: String, required: true },
    docType:    { type: String, required: true }, // e.g. 'TRADE_PROOF', 'LOSS_STATEMENT'
    hash:       { type: String, required: true }, // SHA-256 of document content for integrity
    uploadedAt: { type: Date, default: Date.now },
  }],
  // Approval workflow
  reviewedBy:    { type: String, default: null },
  reviewedAt:    { type: Date, default: null },
  reviewNotes:   { type: String, default: null },
  approvedBy:    { type: String, default: null },
  approvedAt:    { type: Date, default: null },
  rejectedBy:    { type: String, default: null },
  rejectedAt:    { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  // Disbursement
  disbursedAt:   { type: Date, default: null },
  disbursedBy:   { type: String, default: null },
  txHash:        { type: String, default: null },
}, { timestamps: true });

const Claim = mongoose.models.Claim || mongoose.model('Claim', claimSchema);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique human-readable claim reference.
 * Format: CLM-<timestamp>-<6 random hex chars>
 */
function generateClaimRef() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CLM-${ts}-${rand}`;
}

/**
 * Hash document content for integrity tracking.
 * @param {string} content - Raw document content or URL
 * @returns {string} SHA-256 hex digest
 */
function hashDocument(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validate state transition.
 * @param {string} current
 * @param {string} next
 */
function assertValidTransition(current, next) {
  const allowed = VALID_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid transition from "${current}" to "${next}". Allowed: ${allowed.join(', ') || 'none'}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * VALIDATE ELIGIBILITY
 * Checks whether a user/policy is eligible to file a claim.
 * Returns { eligible: boolean, reason: string, policy }
 *
 * @param {string} policyId
 * @param {string} userId
 * @param {string} claimAmount
 * @returns {Promise<object>}
 */
async function validateEligibility(policyId, userId, claimAmount) {
  const policy = await InsurancePolicy.findById(policyId);

  if (!policy) {
    return { eligible: false, reason: 'Policy not found', policy: null };
  }
  if (policy.userId !== userId) {
    return { eligible: false, reason: 'Policy does not belong to this user', policy };
  }
  if (policy.status !== COVERAGE_STATUSES.ACTIVE) {
    return { eligible: false, reason: `Policy status is "${policy.status}", must be ACTIVE`, policy };
  }
  if (policy.endDate < new Date()) {
    return { eligible: false, reason: 'Policy has expired', policy };
  }
  if (new Big(claimAmount).gt(policy.coverageAmount)) {
    return {
      eligible: false,
      reason: `Claim amount ${claimAmount} exceeds coverage limit ${policy.coverageAmount}`,
      policy,
    };
  }

  // Check for existing open claim on this policy
  const openClaim = await Claim.findOne({
    policyId,
    status: { $in: [CLAIM_STATUSES.SUBMITTED, CLAIM_STATUSES.UNDER_REVIEW, CLAIM_STATUSES.APPROVED] },
  });
  if (openClaim) {
    return { eligible: false, reason: `Active claim already exists: ${openClaim.claimRef}`, policy };
  }

  return { eligible: true, reason: 'Eligible', policy };
}

/**
 * SUBMIT CLAIM
 * Creates a new claim after eligibility validation.
 *
 * @param {object} params
 * @param {string} params.policyId
 * @param {string} params.userId
 * @param {string} params.claimAmount
 * @param {string} params.description
 * @param {Array<{url: string, docType: string, content: string}>} params.documents
 * @returns {Promise<object>}
 */
async function submitClaim(params) {
  const { policyId, userId, claimAmount, description, documents = [] } = params;

  if (!policyId || !userId || !claimAmount || !description) {
    throw new Error('policyId, userId, claimAmount, and description are required');
  }
  if (new Big(claimAmount).lte(0)) {
    throw new Error('claimAmount must be greater than 0');
  }
  if (!description.trim() || description.trim().length < 20) {
    throw new Error('description must be at least 20 characters');
  }

  const { eligible, reason, policy } = await validateEligibility(policyId, userId, claimAmount);
  if (!eligible) {
    throw new Error(`Claim ineligible: ${reason}`);
  }

  // Process documents — hash each for integrity
  const processedDocs = documents.map(doc => {
    if (!doc.url || !doc.docType) {
      throw new Error('Each document must have url and docType');
    }
    return {
      url:        doc.url,
      docType:    doc.docType.toUpperCase(),
      hash:       hashDocument(doc.content || doc.url),
      uploadedAt: new Date(),
    };
  });

  const claim = new Claim({
    claimRef:    generateClaimRef(),
    policyId,
    userId,
    marketId:    policy.marketId,
    claimAmount,
    asset:       policy.asset,
    description: description.trim(),
    status:      CLAIM_STATUSES.SUBMITTED,
    documents:   processedDocs,
  });

  await claim.save();

  return { success: true, data: claim, message: 'Claim submitted successfully' };
}

/**
 * ADD DOCUMENT
 * Attach additional documentation to an existing claim.
 *
 * @param {string} claimId
 * @param {string} userId
 * @param {object} doc - { url, docType, content }
 * @returns {Promise<object>}
 */
async function addDocument(claimId, userId, doc) {
  if (!doc?.url || !doc?.docType) throw new Error('Document must have url and docType');

  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');
  if (claim.userId !== userId) throw new Error('Unauthorized');
  if (![CLAIM_STATUSES.SUBMITTED, CLAIM_STATUSES.UNDER_REVIEW].includes(claim.status)) {
    throw new Error(`Cannot add documents to a claim with status "${claim.status}"`);
  }

  claim.documents.push({
    url:        doc.url,
    docType:    doc.docType.toUpperCase(),
    hash:       hashDocument(doc.content || doc.url),
    uploadedAt: new Date(),
  });

  await claim.save();
  return { success: true, data: claim, message: 'Document added successfully' };
}

/**
 * START REVIEW
 * Moves claim to UNDER_REVIEW (admin/moderator).
 *
 * @param {string} claimId
 * @param {string} reviewerId
 * @param {string} [notes]
 * @returns {Promise<object>}
 */
async function startReview(claimId, reviewerId, notes = '') {
  if (!claimId || !reviewerId) throw new Error('claimId and reviewerId are required');

  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');

  assertValidTransition(claim.status, CLAIM_STATUSES.UNDER_REVIEW);

  claim.status     = CLAIM_STATUSES.UNDER_REVIEW;
  claim.reviewedBy = reviewerId;
  claim.reviewedAt = new Date();
  claim.reviewNotes = notes.trim();

  await claim.save();
  return { success: true, data: claim, message: 'Claim moved to UNDER_REVIEW' };
}

/**
 * CALCULATE PAYOUT
 * Determines the approved payout amount.
 * Payout = min(claimAmount, coverageLimit) — can be adjusted by admin.
 *
 * @param {string} claimId
 * @param {string|null} [overrideAmount] - Admin override; defaults to claim amount
 * @returns {Promise<{ payoutAmount: string, claimAmount: string, coverageLimit: string }>}
 */
async function calculatePayout(claimId, overrideAmount = null) {
  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');

  const policy = await InsurancePolicy.findById(claim.policyId);
  if (!policy) throw new Error('Associated policy not found');

  const requested = new Big(claim.claimAmount);
  const limit     = new Big(policy.coverageAmount);
  let payout      = requested.gt(limit) ? limit : requested;

  if (overrideAmount !== null) {
    const override = new Big(overrideAmount);
    if (override.lte(0)) throw new Error('Override amount must be greater than 0');
    if (override.gt(limit)) throw new Error(`Override ${overrideAmount} exceeds coverage limit ${limit.toString()}`);
    payout = override;
  }

  return {
    payoutAmount:   payout.toFixed(8),
    claimAmount:    claim.claimAmount,
    coverageLimit:  policy.coverageAmount,
  };
}

/**
 * APPROVE CLAIM
 * Approves a claim and sets the payout amount.
 *
 * @param {string} claimId
 * @param {string} adminId
 * @param {string|null} [payoutOverride]
 * @returns {Promise<object>}
 */
async function approveClaim(claimId, adminId, payoutOverride = null) {
  if (!claimId || !adminId) throw new Error('claimId and adminId are required');

  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');

  assertValidTransition(claim.status, CLAIM_STATUSES.APPROVED);

  const { payoutAmount } = await calculatePayout(claimId, payoutOverride);

  claim.status      = CLAIM_STATUSES.APPROVED;
  claim.payoutAmount = payoutAmount;
  claim.approvedBy  = adminId;
  claim.approvedAt  = new Date();

  await claim.save();
  return { success: true, data: claim, message: `Claim approved. Payout: ${payoutAmount} ${claim.asset}` };
}

/**
 * REJECT CLAIM
 * Rejects a claim with a reason.
 *
 * @param {string} claimId
 * @param {string} adminId
 * @param {string} rejectionReason - One of CLAIM_REJECTION_REASONS
 * @param {string} [notes]
 * @returns {Promise<object>}
 */
async function rejectClaim(claimId, adminId, rejectionReason, notes = '') {
  if (!claimId || !adminId || !rejectionReason) {
    throw new Error('claimId, adminId, and rejectionReason are required');
  }
  if (!Object.values(CLAIM_REJECTION_REASONS).includes(rejectionReason)) {
    throw new Error(`Invalid rejectionReason. Valid: ${Object.values(CLAIM_REJECTION_REASONS).join(', ')}`);
  }

  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');

  assertValidTransition(claim.status, CLAIM_STATUSES.REJECTED);

  claim.status          = CLAIM_STATUSES.REJECTED;
  claim.rejectedBy      = adminId;
  claim.rejectedAt      = new Date();
  claim.rejectionReason = rejectionReason;
  claim.reviewNotes     = notes.trim() || claim.reviewNotes;

  await claim.save();
  return { success: true, data: claim, message: 'Claim rejected' };
}

/**
 * DISBURSE CLAIM
 * Marks a claim as disbursed and updates the linked policy.
 * Actual fund transfer is handled externally (on-chain or treasury).
 *
 * @param {string} claimId
 * @param {string} disbursedBy
 * @param {string} txHash - On-chain transaction hash
 * @returns {Promise<object>}
 */
async function disburseClaim(claimId, disbursedBy, txHash) {
  if (!claimId || !disbursedBy || !txHash) {
    throw new Error('claimId, disbursedBy, and txHash are required');
  }

  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');

  assertValidTransition(claim.status, CLAIM_STATUSES.DISBURSED);

  claim.status      = CLAIM_STATUSES.DISBURSED;
  claim.disbursedAt = new Date();
  claim.disbursedBy = disbursedBy;
  claim.txHash      = txHash;

  await claim.save();

  // Mark the linked policy as claimed
  await markPolicyClaimed(claim.policyId, claim._id.toString());

  return { success: true, data: claim, message: `Claim disbursed. TX: ${txHash}` };
}

/**
 * GET CLAIM
 * @param {string} claimId
 * @returns {Promise<object>}
 */
async function getClaim(claimId) {
  const claim = await Claim.findById(claimId);
  if (!claim) throw new Error('Claim not found');
  return { success: true, data: claim };
}

/**
 * GET USER CLAIMS
 * @param {string} userId
 * @param {string} [status]
 * @returns {Promise<object>}
 */
async function getUserClaims(userId, status = null) {
  if (!userId) throw new Error('userId is required');
  const query = { userId };
  if (status) {
    if (!Object.values(CLAIM_STATUSES).includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    query.status = status;
  }
  const claims = await Claim.find(query).sort({ createdAt: -1 });
  return { success: true, data: claims };
}

module.exports = {
  validateEligibility,
  submitClaim,
  addDocument,
  startReview,
  calculatePayout,
  approveClaim,
  rejectClaim,
  disburseClaim,
  getClaim,
  getUserClaims,
  hashDocument,
  CLAIM_STATUSES,
  CLAIM_REJECTION_REASONS,
  VALID_TRANSITIONS,
};
