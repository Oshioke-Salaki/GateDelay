import {
  DeploymentRegistryError,
  findDeployment,
  parseDeploymentRegistry,
} from './deployment-registry';

const REGISTRY = JSON.stringify({
  contracts: [
    {
      name: 'MarketBridge',
      address: '0x000000000000000000000000000000000000beef',
      chainId: 1,
      abiVersion: '1.0.0',
    },
    {
      name: 'MarketWithdraw',
      address: '0x000000000000000000000000000000000000cafe',
      chainId: 1,
      abiVersion: '1.0.0',
    },
  ],
});

describe('deployment registry', () => {
  it('reads name, address, chain id, and abi version', () => {
    const entries = parseDeploymentRegistry(REGISTRY);
    expect(entries).toHaveLength(2);
    expect(findDeployment(entries, 'MarketBridge')).toEqual({
      name: 'MarketBridge',
      address: '0x000000000000000000000000000000000000beef',
      chainId: 1,
      abiVersion: '1.0.0',
    });
  });

  it('rejects an entry that omits a required field', () => {
    expect(() =>
      parseDeploymentRegistry(
        JSON.stringify({
          contracts: [{ name: 'Trading', address: '0x0000000000000000000000000000000000000001' }],
        }),
      ),
    ).toThrow(DeploymentRegistryError);
  });
});
