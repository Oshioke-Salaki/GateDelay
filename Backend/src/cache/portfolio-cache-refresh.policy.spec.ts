import { CacheKeys, planCacheRefresh } from './cache-refresh.policy';

describe('portfolio cache refresh policy', () => {
  it('evicts only the affected user portfolio on position change', () => {
    expect(
      planCacheRefresh({ type: 'portfolio.position_changed', userId: 'u1' }),
    ).toEqual({ keys: [CacheKeys.portfolio('u1')], prefixes: [] });
  });

  it('evicts all affected user portfolios on valuation update', () => {
    expect(
      planCacheRefresh({ type: 'portfolio.valuation_updated', userIds: ['u1', 'u2'] }),
    ).toEqual({
      keys: [CacheKeys.portfolio('u1'), CacheKeys.portfolio('u2')],
      prefixes: [],
    });
  });

  it('portfolio keys fall under the portfolio prefix', () => {
    expect(CacheKeys.portfolio('u1')).toMatch(
      new RegExp(`^${CacheKeys.portfolioPrefix}`),
    );
  });
});
