const { Web3 } = require('web3');
const mongoose = require('mongoose');

/**
 * GOVERNANCE SERVICE
 * Handles market governance operations including proposals, voting, and decision execution.
 */

// In-memory store for simulation (In production, these would be Mongoose models)
const proposals = new Map();
const votingHistory = [];

const PROPOSAL_STATUS = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  DEFEATED: 'Defeated',
  SUCCEEDED: 'Succeeded',
  EXECUTED: 'Executed',
  EXPIRED: 'Expired'
};

/**
 * Create a new governance proposal
 * @param {object} proposalData 
 * @returns {string} proposalId
 */
async function createProposal(proposalData) {
  const proposalId = 'prop_' + Math.random().toString(36).substr(2, 9);
  
  const newProposal = {
    id: proposalId,
    title: proposalData.title,
    description: proposalData.description,
    proposer: proposalData.proposer,
    actions: proposalData.actions || [], // Smart contract calls to execute
    status: PROPOSAL_STATUS.ACTIVE,
    votesFor: 0,
    votesAgainst: 0,
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days duration
    createdAt: new Date().toISOString()
  };

  proposals.set(proposalId, newProposal);
  return proposalId;
}

/**
 * Cast a vote on a proposal
 * @param {string} proposalId 
 * @param {string} voter 
 * @param {boolean} support 
 * @param {number} weight 
 */
async function castVote(proposalId, voter, support, weight) {
  const proposal = proposals.get(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== PROPOSAL_STATUS.ACTIVE) throw new Error('Proposal is not active');
  if (new Date() > proposal.endTime) {
    proposal.status = PROPOSAL_STATUS.EXPIRED;
    throw new Error('Voting period has ended');
  }

  if (support) {
    proposal.votesFor += weight;
  } else {
    proposal.votesAgainst += weight;
  }

  const voteEntry = {
    proposalId,
    voter,
    support,
    weight,
    timestamp: new Date().toISOString()
  };

  votingHistory.push(voteEntry);
  return voteEntry;
}

/**
 * Execute a successful proposal
 * @param {string} proposalId 
 */
async function executeProposal(proposalId) {
  const proposal = proposals.get(proposalId);
  if (!proposal) throw new Error('Proposal not found');
  
  // Logic to check quorum and majority
  const totalVotes = proposal.votesFor + proposal.votesAgainst;
  const quorum = 1000; // Mock quorum requirement
  
  if (totalVotes < quorum) {
    proposal.status = PROPOSAL_STATUS.DEFEATED;
    throw new Error('Quorum not reached');
  }

  if (proposal.votesFor <= proposal.votesAgainst) {
    proposal.status = PROPOSAL_STATUS.DEFEATED;
    throw new Error('Proposal did not receive majority support');
  }

  console.log(`Executing governance actions for proposal ${proposalId}...`);
  // In production: trigger smart contract actions via web3.js
  
  proposal.status = PROPOSAL_STATUS.EXECUTED;
  proposal.executedAt = new Date().toISOString();
  
  return {
    success: true,
    proposalId,
    status: proposal.status,
    executedAt: proposal.executedAt
  };
}

/**
 * Get governance history (past proposals and decisions)
 */
async function getGovernanceHistory() {
  return Array.from(proposals.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Provide governance analytics
 */
async function getGovernanceAnalytics() {
  const allProposals = Array.from(proposals.values());
  const totalProposals = allProposals.length;
  const activeProposals = allProposals.filter(p => p.status === PROPOSAL_STATUS.ACTIVE).length;
  const executedProposals = allProposals.filter(p => p.status === PROPOSAL_STATUS.EXECUTED).length;
  
  const totalVotesCast = votingHistory.reduce((sum, v) => sum + v.weight, 0);

  return {
    totalProposals,
    activeProposals,
    executedProposals,
    totalVotesCast,
    participationRate: totalProposals > 0 ? (votingHistory.length / totalProposals).toFixed(2) : 0,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  createProposal,
  castVote,
  executeProposal,
  getGovernanceHistory,
  getGovernanceAnalytics,
  PROPOSAL_STATUS
};
