const { evaluate } = require('math.js');

/**
 * In-memory storage for voting data
 */
const store = {
  proposals: new Map(),
  votes: new Map(),
  delegations: new Map(),
  userBalances: new Map(),
};

/**
 * Initialize a proposal
 * @param {string} proposalId - Unique proposal identifier
 * @param {object} proposalData - Proposal metadata
 */
function initializeProposal(proposalId, proposalData = {}) {
  if (store.proposals.has(proposalId)) {
    throw new Error(`Proposal ${proposalId} already exists`);
  }

  store.proposals.set(proposalId, {
    id: proposalId,
    createdAt: new Date(),
    choices: proposalData.choices || ['yes', 'no'],
    active: true,
    ...proposalData,
  });

  store.votes.set(proposalId, new Map());
}

/**
 * Set user token balance (mocked if no web3.js available)
 * @param {string} userAddress - User address
 * @param {number} balance - Token balance
 */
function setUserBalance(userAddress, balance) {
  const normalized = normalizeAddress(userAddress);
  store.userBalances.set(normalized, balance);
}

/**
 * Get user token balance
 * @param {string} userAddress - User address
 * @returns {number} Token balance
 */
function getUserBalance(userAddress) {
  const normalized = normalizeAddress(userAddress);
  return store.userBalances.get(normalized) || 0;
}

/**
 * Normalize address (lowercase, trim)
 * @param {string} address - Raw address
 * @returns {string} Normalized address
 */
function normalizeAddress(address) {
  if (!address || typeof address !== 'string') {
    throw new Error('Invalid address');
  }
  return address.toLowerCase().trim();
}

/**
 * Get delegation chain for a user
 * @param {string} userAddress - User address
 * @returns {object} { delegatee, chain }
 */
function getDelegationChain(userAddress) {
  const normalized = normalizeAddress(userAddress);
  const chain = [normalized];
  let current = normalized;
  const visited = new Set([normalized]);

  while (store.delegations.has(current)) {
    const delegatee = store.delegations.get(current);

    if (visited.has(delegatee)) {
      throw new Error(`Circular delegation detected for ${userAddress}`);
    }

    chain.push(delegatee);
    visited.add(delegatee);
    current = delegatee;
  }

  return {
    delegatee: current !== normalized ? current : null,
    chain: chain,
  };
}

/**
 * Calculate voting power for a user (including delegated power)
 * @param {string} userAddress - User address
 * @returns {number} Total voting power
 */
function calculateVotingPower(userAddress) {
  const normalized = normalizeAddress(userAddress);

  // Check if this user is delegating
  const delegation = getDelegationChain(normalized);
  if (delegation.delegatee) {
    return 0;
  }

  let totalPower = getUserBalance(normalized);

  // Add delegated power from users who delegated to this user
  for (const [delegator, delegatee] of store.delegations.entries()) {
    if (delegatee === normalized) {
      totalPower += getUserBalance(delegator);
    }
  }

  return totalPower;
}

/**
 * Check if user can vote on a proposal
 * @param {string} proposalId - Proposal ID
 * @param {string} userAddress - User address
 * @returns {boolean} Can vote
 */
function canVote(proposalId, userAddress) {
  const normalized = normalizeAddress(userAddress);
  const proposalVotes = store.votes.get(proposalId);

  if (!proposalVotes) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  // Check if already voted
  if (proposalVotes.has(normalized)) {
    return false;
  }

  // Check if has voting power
  const votingPower = calculateVotingPower(normalized);
  return votingPower > 0;
}

/**
 * Submit a vote
 * @param {object} voteData - { proposalId, userAddress, choice }
 * @returns {object} Vote receipt
 */
function submitVote(voteData) {
  const { proposalId, userAddress, choice } = voteData;

  if (!proposalId || !userAddress || !choice) {
    throw new Error('Missing required fields: proposalId, userAddress, choice');
  }

  const normalized = normalizeAddress(userAddress);
  const proposal = store.proposals.get(proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  if (!proposal.active) {
    throw new Error(`Proposal ${proposalId} is not active`);
  }

  const proposalVotes = store.votes.get(proposalId);

  // Prevent double voting
  if (proposalVotes.has(normalized)) {
    throw new Error(`User ${normalized} has already voted on proposal ${proposalId}`);
  }

  // Validate choice
  if (!proposal.choices.includes(choice)) {
    throw new Error(`Invalid choice: ${choice}. Valid choices: ${proposal.choices.join(', ')}`);
  }

  // Calculate voting power
  const votingPower = calculateVotingPower(normalized);

  if (votingPower <= 0) {
    throw new Error(`User ${normalized} has no voting power`);
  }

  // Record vote
  const vote = {
    voter: normalized,
    choice: choice,
    votingPower: votingPower,
    timestamp: new Date(),
    proposalId: proposalId,
  };

  proposalVotes.set(normalized, vote);

  return {
    success: true,
    message: `Vote submitted successfully`,
    vote: vote,
  };
}

/**
 * Delegate voting power
 * @param {string} from - Delegator address
 * @param {string} to - Delegatee address
 * @returns {object} Delegation receipt
 */
function delegateVote(from, to) {
  const fromNormalized = normalizeAddress(from);
  const toNormalized = normalizeAddress(to);

  // Cannot delegate to self
  if (fromNormalized === toNormalized) {
    throw new Error('Cannot delegate to self');
  }

  // Check for circular delegation
  const delegationChain = getDelegationChain(toNormalized);
  if (delegationChain.chain.includes(fromNormalized)) {
    throw new Error(`Delegation would create a loop: ${from} -> ${to}`);
  }

  // Store delegation
  store.delegations.set(fromNormalized, toNormalized);

  return {
    success: true,
    message: `Vote delegation successful`,
    from: fromNormalized,
    to: toNormalized,
    timestamp: new Date(),
  };
}

/**
 * Revoke delegation
 * @param {string} userAddress - User address
 * @returns {object} Revocation receipt
 */
function revokeDelegation(userAddress) {
  const normalized = normalizeAddress(userAddress);

  if (!store.delegations.has(normalized)) {
    throw new Error(`User ${normalized} has no active delegation`);
  }

  store.delegations.delete(normalized);

  return {
    success: true,
    message: `Delegation revoked`,
    user: normalized,
    timestamp: new Date(),
  };
}

/**
 * Calculate voting results for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {object} Results with vote counts, percentages, and stats
 */
function calculateResults(proposalId) {
  const proposal = store.proposals.get(proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const proposalVotes = store.votes.get(proposalId);
  if (!proposalVotes || proposalVotes.size === 0) {
    return {
      proposalId: proposalId,
      results: proposal.choices.map((choice) => ({
        choice: choice,
        votes: 0,
        votingPower: 0,
        percentage: 0,
      })),
      totalVotes: 0,
      totalVotingPower: 0,
      participationRate: 0,
    };
  }

  const results = {};
  let totalVotingPower = 0;

  // Initialize results
  proposal.choices.forEach((choice) => {
    results[choice] = {
      choice: choice,
      votes: 0,
      votingPower: 0,
    };
  });

  // Aggregate votes
  proposalVotes.forEach((vote) => {
    results[vote.choice].votes += 1;
    results[vote.choice].votingPower += vote.votingPower;
    totalVotingPower += vote.votingPower;
  });

  // Calculate percentages
  const resultsArray = proposal.choices.map((choice) => {
    const result = results[choice];
    const percentage = totalVotingPower > 0 ? (result.votingPower / totalVotingPower) * 100 : 0;

    return {
      choice: choice,
      votes: result.votes,
      votingPower: result.votingPower,
      percentage: parseFloat(percentage.toFixed(2)),
    };
  });

  // Sort by voting power descending
  resultsArray.sort((a, b) => b.votingPower - a.votingPower);

  return {
    proposalId: proposalId,
    results: resultsArray,
    totalVotes: proposalVotes.size,
    totalVotingPower: totalVotingPower,
    participationRate: parseFloat(
      ((proposalVotes.size / store.userBalances.size) * 100).toFixed(2),
    ),
  };
}

/**
 * Get voting analytics for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {object} Comprehensive voting analytics
 */
function getVotingAnalytics(proposalId) {
  const proposal = store.proposals.get(proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const proposalVotes = store.votes.get(proposalId);
  const results = calculateResults(proposalId);

  // Get top voters
  const topVoters = Array.from(proposalVotes.values())
    .sort((a, b) => b.votingPower - a.votingPower)
    .slice(0, 10)
    .map((vote) => ({
      voter: vote.voter,
      choice: vote.choice,
      votingPower: vote.votingPower,
      timestamp: vote.timestamp,
    }));

  // Get voter distribution by choice
  const choiceDistribution = {};
  proposal.choices.forEach((choice) => {
    choiceDistribution[choice] = [];
  });

  proposalVotes.forEach((vote) => {
    if (!choiceDistribution[vote.choice]) {
      choiceDistribution[vote.choice] = [];
    }
    choiceDistribution[vote.choice].push({
      voter: vote.voter,
      votingPower: vote.votingPower,
      timestamp: vote.timestamp,
    });
  });

  // Calculate delegation stats
  let totalDelegations = 0;
  let delegatorsWithVotes = 0;
  const delegateDistribution = {};

  store.delegations.forEach((delegatee) => {
    totalDelegations += 1;
    delegateDistribution[delegatee] = (delegateDistribution[delegatee] || 0) + 1;
  });

  proposalVotes.forEach((vote) => {
    store.delegations.forEach((delegatee, delegator) => {
      if (vote.voter === delegatee) {
        delegatorsWithVotes += 1;
      }
    });
  });

  // Sort choices by voting power
  const choiceStats = results.results.map((result) => {
    const voters = choiceDistribution[result.choice] || [];
    return {
      choice: result.choice,
      voters: voters.length,
      totalVotingPower: result.votingPower,
      percentage: result.percentage,
      averageVotingPower:
        voters.length > 0 ? parseFloat((result.votingPower / voters.length).toFixed(2)) : 0,
    };
  });

  // Get timestamp statistics
  const timestamps = Array.from(proposalVotes.values()).map((v) => new Date(v.timestamp));
  const oldestVote = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
  const newestVote = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

  return {
    proposalId: proposalId,
    proposalActive: proposal.active,
    totalVoters: proposalVotes.size,
    totalVotingPower: results.totalVotingPower,
    participationRate: results.participationRate,
    averageVotingPowerPerVoter:
      proposalVotes.size > 0
        ? parseFloat((results.totalVotingPower / proposalVotes.size).toFixed(2))
        : 0,
    choiceStats: choiceStats,
    topVoters: topVoters,
    totalDelegationsActive: totalDelegations,
    delegateWithMostVotingPower: Object.entries(delegateDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 1)
      .map(([delegate, count]) => ({
        delegate: delegate,
        delegatorCount: count,
      }))[0] || null,
    votingTimeline: {
      oldestVote: oldestVote,
      newestVote: newestVote,
      totalVotingEvents: proposalVotes.size,
    },
    results: results.results,
  };
}

/**
 * Get all proposals
 * @returns {array} List of all proposals
 */
function getAllProposals() {
  return Array.from(store.proposals.values()).map((proposal) => ({
    ...proposal,
    voteCount: store.votes.get(proposal.id)?.size || 0,
  }));
}

/**
 * Get proposal details
 * @param {string} proposalId - Proposal ID
 * @returns {object} Proposal with vote details
 */
function getProposal(proposalId) {
  const proposal = store.proposals.get(proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  const proposalVotes = store.votes.get(proposalId);

  return {
    ...proposal,
    voteCount: proposalVotes?.size || 0,
    results: calculateResults(proposalId),
  };
}

/**
 * Get user voting history
 * @param {string} userAddress - User address
 * @returns {array} User's votes
 */
function getUserVotingHistory(userAddress) {
  const normalized = normalizeAddress(userAddress);
  const history = [];

  store.votes.forEach((proposalVotes, proposalId) => {
    if (proposalVotes.has(normalized)) {
      history.push({
        proposalId: proposalId,
        vote: proposalVotes.get(normalized),
      });
    }
  });

  return history;
}

/**
 * Get user delegation status
 * @param {string} userAddress - User address
 * @returns {object} Delegation info
 */
function getUserDelegationStatus(userAddress) {
  const normalized = normalizeAddress(userAddress);
  const delegation = getDelegationChain(normalized);

  const delegatedFrom = [];
  store.delegations.forEach((delegatee, delegator) => {
    if (delegatee === normalized) {
      delegatedFrom.push({
        delegator: delegator,
        votingPower: getUserBalance(delegator),
      });
    }
  });

  return {
    user: normalized,
    delegatedTo: delegation.delegatee,
    delegatedFrom: delegatedFrom,
    totalDelegatedPower: delegatedFrom.reduce((sum, d) => sum + d.votingPower, 0),
    totalVotingPower: calculateVotingPower(normalized),
    ownVotingPower: getUserBalance(normalized),
  };
}

/**
 * Close a proposal (no more voting allowed)
 * @param {string} proposalId - Proposal ID
 * @returns {object} Success confirmation
 */
function closeProposal(proposalId) {
  const proposal = store.proposals.get(proposalId);

  if (!proposal) {
    throw new Error(`Proposal ${proposalId} not found`);
  }

  proposal.active = false;
  proposal.closedAt = new Date();

  return {
    success: true,
    message: `Proposal ${proposalId} closed`,
    proposal: proposal,
  };
}

/**
 * Reset all data (for testing)
 */
function resetData() {
  store.proposals.clear();
  store.votes.clear();
  store.delegations.clear();
  store.userBalances.clear();
}

module.exports = {
  // Core voting functions
  submitVote,
  calculateVotingPower,
  calculateResults,
  getVotingAnalytics,

  // Delegation functions
  delegateVote,
  revokeDelegation,

  // Proposal management
  initializeProposal,
  getProposal,
  getAllProposals,
  closeProposal,

  // User functions
  getUserVotingHistory,
  getUserDelegationStatus,

  // Balance management
  setUserBalance,
  getUserBalance,

  // Utility functions
  canVote,
  getDelegationChain,
  normalizeAddress,

  // Testing
  resetData,
};
