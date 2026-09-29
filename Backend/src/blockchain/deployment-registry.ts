export interface DeploymentEntry {
  name: string;
  address: string;
  chainId: number;
  abiVersion: string;
}

interface DeploymentRegistryFile {
  contracts?: DeploymentEntry[];
}

export class DeploymentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeploymentRegistryError';
  }
}

/** Parse the JSON document produced by `WriteDeploymentRegistry`. */
export function parseDeploymentRegistry(raw: string): DeploymentEntry[] {
  let parsed: DeploymentRegistryFile;
  try {
    parsed = JSON.parse(raw) as DeploymentRegistryFile;
  } catch {
    throw new DeploymentRegistryError('Deployment registry is not valid JSON');
  }

  if (!parsed || !Array.isArray(parsed.contracts)) {
    throw new DeploymentRegistryError('Deployment registry is missing a contracts array');
  }

  return parsed.contracts.map((entry, index) => {
    if (
      !entry ||
      typeof entry.name !== 'string' ||
      entry.name.length === 0 ||
      typeof entry.address !== 'string' ||
      !/^0x[0-9a-fA-F]{40}$/.test(entry.address) ||
      typeof entry.abiVersion !== 'string' ||
      entry.abiVersion.length === 0 ||
      typeof entry.chainId !== 'number' ||
      !Number.isInteger(entry.chainId)
    ) {
      throw new DeploymentRegistryError(
        `Deployment registry entry ${index} is missing name, address, chainId, or abiVersion`,
      );
    }

    return {
      name: entry.name,
      address: entry.address,
      chainId: entry.chainId,
      abiVersion: entry.abiVersion,
    };
  });
}

export function findDeployment(
  entries: DeploymentEntry[],
  name: string,
): DeploymentEntry | undefined {
  return entries.find((entry) => entry.name === name);
}
