const governanceService = require('../services/governanceService');

describe('Governance Service', () => {
  let proposalId;
  const voter1 = '0xVoter1...';
  const voter2 = '0xVoter2...';

  it('should create a new proposal', async () => {
    proposalId = await governanceService.createProposal({
      title: 'Update Fee Structure',
      description: 'Proposal to reduce trading fees by 0.05%',
      proposer: '0xAdmin...',
      actions: [{ target: 'FeeHandler', method: 'updateFee', params: [0.001] }]
    });

    expect(proposalId).toBeDefined();
    expect(proposalId).toMatch(/^prop_/);
  });

  it('should allow casting votes', async () => {
    const vote1 = await governanceService.castVote(proposalId, voter1, true, 600);
    const vote2 = await governanceService.castVote(proposalId, voter2, false, 200);

    expect(vote1.support).toBe(true);
    expect(vote2.support).toBe(false);

    const history = await governanceService.getGovernanceHistory();
    const prop = history.find(h => h.id === proposalId);
    expect(prop.votesFor).toBe(600);
    expect(prop.votesAgainst).toBe(200);
  });

  it('should execute proposal when conditions are met', async () => {
    // Add more votes to reach quorum (1000)
    await governanceService.castVote(proposalId, '0xVoter3...', true, 500);
    
    const result = await governanceService.executeProposal(proposalId);
    expect(result.success).toBe(true);
    expect(result.status).toBe(governanceService.PROPOSAL_STATUS.EXECUTED);
  });

  it('should fail execution if quorum is not reached', async () => {
    const lowQuorumPropId = await governanceService.createProposal({
      title: 'Low Support Prop',
      proposer: '0xUser...'
    });
    
    await governanceService.castVote(lowQuorumPropId, voter1, true, 100);
    
    await expect(governanceService.executeProposal(lowQuorumPropId))
      .rejects.toThrow('Quorum not reached');
  });

  it('should provide governance analytics', async () => {
    const analytics = await governanceService.getGovernanceAnalytics();
    expect(analytics.totalProposals).toBeGreaterThan(0);
    expect(analytics.totalVotesCast).toBeGreaterThan(0);
    expect(analytics).toHaveProperty('participationRate');
  });
});
