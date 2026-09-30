import {
  ContractExpectation,
  DeploymentRegistryError,
  parseDeploymentRegistry,
  validateDeploymentsAgainstExpectations,
} from './deployment-registry';

const DEFAULT_EXPECTATIONS: ContractExpectation[] = [
  {
    name: 'Trading',
    abiVersion: '1.0.0',
    addressEnv: 'TRADING_ADDRESS',
  },
  {
    name: 'MarketSettlement',
    abiVersion: '1.0.0',
    addressEnv: 'MARKET_SETTLEMENT_ADDRESS',
  },
  {
    name: 'Resolution',
    abiVersion: '1.0.0',
    addressEnv: 'RESOLUTION_ADDRESS',
  },
  {
    name: 'MarketBridge',
    abiVersion: '1.0.0',
    addressEnv: 'MARKET_BRIDGE_ADDRESS',
  },
  {
    name: 'MarketMinter',
    abiVersion: '1.0.0',
    addressEnv: 'MARKET_MINTER_ADDRESS',
  },
  {
    name: 'MarketWithdraw',
    abiVersion: '1.0.0',
    addressEnv: 'MARKET_WITHDRAW_ADDRESS',
  },
];

export class ContractStartupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractStartupValidationError';
  }
}

function parseExpectations(raw?: string): ContractExpectation[] {
  if (!raw) return DEFAULT_EXPECTATIONS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ContractStartupValidationError(
      'CONTRACT_ABI_EXPECTATIONS_JSON is not valid JSON',
    );
  }

  if (!Array.isArray(parsed)) {
    throw new ContractStartupValidationError(
      'CONTRACT_ABI_EXPECTATIONS_JSON must be an array',
    );
  }

  return parsed.map((entry, index) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as ContractExpectation).name !== 'string' ||
      typeof (entry as ContractExpectation).abiVersion !== 'string' ||
      ((entry as ContractExpectation).addressEnv !== undefined &&
        typeof (entry as ContractExpectation).addressEnv !== 'string')
    ) {
      throw new ContractStartupValidationError(
        `CONTRACT_ABI_EXPECTATIONS_JSON entry ${index} must include name and abiVersion`,
      );
    }

    return entry as ContractExpectation;
  });
}

export function assertContractStartupConfig(
  env: Record<string, string | undefined> = process.env,
): void {
  const registry = env.DEPLOYMENT_REGISTRY_JSON;
  if (!registry) return;

  const expectations = parseExpectations(env.CONTRACT_ABI_EXPECTATIONS_JSON);
  if (expectations.length === 0) return;

  try {
    const entries = parseDeploymentRegistry(registry);
    const result = validateDeploymentsAgainstExpectations(
      entries,
      expectations,
      env,
    );
    if (!result.valid) {
      throw new ContractStartupValidationError(result.errors.join('; '));
    }
  } catch (err) {
    if (
      err instanceof ContractStartupValidationError ||
      err instanceof DeploymentRegistryError
    ) {
      throw err;
    }
    throw new ContractStartupValidationError(
      err instanceof Error ? err.message : 'Contract startup validation failed',
    );
  }
}
