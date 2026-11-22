import {
  DeploymentRegistryError,
  findDeployment,
  parseDeploymentRegistry,
  validateDeploymentsAgainstExpectations,
} from './deployment-registry';
import {
  assertContractStartupConfig,
  ContractStartupValidationError,
} from './contract-startup-validation';

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

  it('validates expected ABI versions and configured addresses', () => {
    const entries = parseDeploymentRegistry(REGISTRY);

    const result = validateDeploymentsAgainstExpectations(
      entries,
      [
        {
          name: 'MarketBridge',
          abiVersion: '1.0.0',
          addressEnv: 'MARKET_BRIDGE_ADDRESS',
        },
      ],
      {
        MARKET_BRIDGE_ADDRESS: '0x000000000000000000000000000000000000BEEF',
      },
    );

    expect(result.valid).toBe(true);
    expect(result.checked).toBe(1);
  });

  it('reports ABI version and address mismatches', () => {
    const entries = parseDeploymentRegistry(REGISTRY);

    const result = validateDeploymentsAgainstExpectations(
      entries,
      [
        {
          name: 'MarketBridge',
          abiVersion: '2.0.0',
          addressEnv: 'MARKET_BRIDGE_ADDRESS',
        },
      ],
      {
        MARKET_BRIDGE_ADDRESS: '0x0000000000000000000000000000000000000001',
      },
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      'MarketBridge ABI version mismatch: expected 2.0.0, got 1.0.0',
      'MarketBridge address mismatch: MARKET_BRIDGE_ADDRESS=0x0000000000000000000000000000000000000001 but registry has 0x000000000000000000000000000000000000beef',
    ]);
  });

  it('fails startup when contract expectations are not met', () => {
    expect(() =>
      assertContractStartupConfig({
        DEPLOYMENT_REGISTRY_JSON: REGISTRY,
        CONTRACT_ABI_EXPECTATIONS_JSON: JSON.stringify([
          { name: 'MarketBridge', abiVersion: '9.9.9' },
        ]),
      }),
    ).toThrow(ContractStartupValidationError);
  });
});
