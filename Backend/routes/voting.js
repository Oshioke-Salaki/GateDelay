const express = require('express');
const votingService = require('../services/votingService');

const router = express.Router();

/**
 * Middleware for error handling
 */
const handleErrors = (fn) => (req, res, next) => {
  try {
    return fn(req, res, next);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
      code: error.code || 'VOTING_ERROR',
    });
  }
};

/**
 * Middleware for request validation
 */
const validateRequest = (requiredFields) => (req, res, next) => {
  const missingFields = requiredFields.filter((field) => !req.body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
      code: 'VALIDATION_ERROR',
    });
  }

  next();
};

/**
 * POST /vote
 * Submit a vote on a proposal
 *
 * Request body:
 * {
 *   "proposalId": "string",
 *   "userAddress": "string",
 *   "choice": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "vote": {...},
 *     "votingPower": number
 *   }
 * }
 */
router.post(
  '/vote',
  validateRequest(['proposalId', 'userAddress', 'choice']),
  handleErrors((req, res) => {
    const { proposalId, userAddress, choice } = req.body;

    const result = votingService.submitVote({
      proposalId,
      userAddress,
      choice,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * POST /delegate
 * Delegate voting power to another user
 *
 * Request body:
 * {
 *   "from": "string",
 *   "to": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...}
 * }
 */
router.post(
  '/delegate',
  validateRequest(['from', 'to']),
  handleErrors((req, res) => {
    const { from, to } = req.body;

    const result = votingService.delegateVote(from, to);

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * POST /revoke-delegation
 * Revoke a voting delegation
 *
 * Request body:
 * {
 *   "userAddress": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...}
 * }
 */
router.post(
  '/revoke-delegation',
  validateRequest(['userAddress']),
  handleErrors((req, res) => {
    const { userAddress } = req.body;

    const result = votingService.revokeDelegation(userAddress);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * GET /results/:proposalId
 * Get voting results for a proposal
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [...],
 *     "totalVotes": number,
 *     "totalVotingPower": number,
 *     "participationRate": number
 *   }
 * }
 */
router.get(
  '/results/:proposalId',
  handleErrors((req, res) => {
    const { proposalId } = req.params;

    const results = votingService.calculateResults(proposalId);

    res.status(200).json({
      success: true,
      data: results,
    });
  }),
);

/**
 * GET /analytics/:proposalId
 * Get comprehensive voting analytics
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalVoters": number,
 *     "totalVotingPower": number,
 *     "participationRate": number,
 *     "topVoters": [...],
 *     "choiceStats": [...],
 *     ...
 *   }
 * }
 */
router.get(
  '/analytics/:proposalId',
  handleErrors((req, res) => {
    const { proposalId } = req.params;

    const analytics = votingService.getVotingAnalytics(proposalId);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  }),
);

/**
 * GET /voting-power/:userAddress
 * Get voting power for a user
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "userAddress": "string",
 *     "totalVotingPower": number,
 *     "ownVotingPower": number,
 *     "delegatedTo": "string | null",
 *     "delegatedFrom": [...]
 *   }
 * }
 */
router.get(
  '/voting-power/:userAddress',
  handleErrors((req, res) => {
    const { userAddress } = req.params;

    const votingPower = votingService.calculateVotingPower(userAddress);
    const delegationStatus = votingService.getUserDelegationStatus(userAddress);

    res.status(200).json({
      success: true,
      data: {
        userAddress: votingService.normalizeAddress(userAddress),
        totalVotingPower: votingPower,
        ...delegationStatus,
      },
    });
  }),
);

/**
 * GET /voting-power/:userAddress/can-vote/:proposalId
 * Check if user can vote on a proposal
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "canVote": boolean,
 *     "reason": "string",
 *     "votingPower": number
 *   }
 * }
 */
router.get(
  '/voting-power/:userAddress/can-vote/:proposalId',
  handleErrors((req, res) => {
    const { userAddress, proposalId } = req.params;

    const votingPower = votingService.calculateVotingPower(userAddress);
    let canVote = false;
    let reason = '';

    try {
      canVote = votingService.canVote(proposalId, userAddress);
      reason = canVote ? 'User is eligible to vote' : 'User has already voted on this proposal';
    } catch (error) {
      reason = error.message;
    }

    res.status(200).json({
      success: true,
      data: {
        userAddress: votingService.normalizeAddress(userAddress),
        proposalId,
        canVote,
        reason,
        votingPower,
      },
    });
  }),
);

/**
 * GET /proposals/:proposalId
 * Get proposal details with voting results
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "string",
 *     "choices": [...],
 *     "active": boolean,
 *     "voteCount": number,
 *     "results": {...}
 *   }
 * }
 */
router.get(
  '/proposals/:proposalId',
  handleErrors((req, res) => {
    const { proposalId } = req.params;

    const proposal = votingService.getProposal(proposalId);

    res.status(200).json({
      success: true,
      data: proposal,
    });
  }),
);

/**
 * GET /proposals
 * Get all proposals
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [...]
 * }
 */
router.get(
  '/proposals',
  handleErrors((req, res) => {
    const proposals = votingService.getAllProposals();

    res.status(200).json({
      success: true,
      data: proposals,
    });
  }),
);

/**
 * POST /proposals
 * Create a new proposal
 *
 * Request body:
 * {
 *   "proposalId": "string",
 *   "choices": ["string"],
 *   "metadata": {...}
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...}
 * }
 */
router.post(
  '/proposals',
  validateRequest(['proposalId']),
  handleErrors((req, res) => {
    const { proposalId, choices, metadata } = req.body;

    votingService.initializeProposal(proposalId, {
      choices: choices || ['yes', 'no'],
      ...metadata,
    });

    res.status(201).json({
      success: true,
      data: {
        proposalId,
        message: 'Proposal created successfully',
      },
    });
  }),
);

/**
 * POST /proposals/:proposalId/close
 * Close a proposal (no more voting allowed)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...}
 * }
 */
router.post(
  '/proposals/:proposalId/close',
  handleErrors((req, res) => {
    const { proposalId } = req.params;

    const result = votingService.closeProposal(proposalId);

    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

/**
 * GET /user-history/:userAddress
 * Get user's voting history
 *
 * Response:
 * {
 *   "success": true,
 *   "data": [...]
 * }
 */
router.get(
  '/user-history/:userAddress',
  handleErrors((req, res) => {
    const { userAddress } = req.params;

    const history = votingService.getUserVotingHistory(userAddress);
    const delegationStatus = votingService.getUserDelegationStatus(userAddress);

    res.status(200).json({
      success: true,
      data: {
        userAddress: votingService.normalizeAddress(userAddress),
        votingHistory: history,
        delegationStatus,
      },
    });
  }),
);

/**
 * GET /delegation-status/:userAddress
 * Get user's delegation status
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...}
 * }
 */
router.get(
  '/delegation-status/:userAddress',
  handleErrors((req, res) => {
    const { userAddress } = req.params;

    const delegationStatus = votingService.getUserDelegationStatus(userAddress);

    res.status(200).json({
      success: true,
      data: delegationStatus,
    });
  }),
);

/**
 * POST /balance/:userAddress
 * Set user balance (for testing/initialization)
 *
 * Request body:
 * {
 *   "balance": number
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {...}
 * }
 */
router.post(
  '/balance/:userAddress',
  validateRequest(['balance']),
  handleErrors((req, res) => {
    const { userAddress } = req.params;
    const { balance } = req.body;

    if (typeof balance !== 'number' || balance < 0) {
      throw new Error('Balance must be a non-negative number');
    }

    votingService.setUserBalance(userAddress, balance);

    res.status(200).json({
      success: true,
      data: {
        userAddress: votingService.normalizeAddress(userAddress),
        balance,
        message: 'Balance set successfully',
      },
    });
  }),
);

/**
 * GET /balance/:userAddress
 * Get user balance
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "userAddress": "string",
 *     "balance": number
 *   }
 * }
 */
router.get(
  '/balance/:userAddress',
  handleErrors((req, res) => {
    const { userAddress } = req.params;

    const balance = votingService.getUserBalance(userAddress);

    res.status(200).json({
      success: true,
      data: {
        userAddress: votingService.normalizeAddress(userAddress),
        balance,
      },
    });
  }),
);

/**
 * Error handling for undefined routes
 */
router.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
  });
});

module.exports = router;
