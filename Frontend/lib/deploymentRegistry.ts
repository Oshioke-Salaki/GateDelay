export interface DeploymentEntry {
  name: string;
  address: `0x${string}`;
  chainId: number;
  abiVersion: string;
}

interface DeploymentRegistryFile {
  contracts?: DeploymentEntry[];
}

export class DeploymentRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentRegistryError";
  }
}

/** Parse the JSON document produced by `WriteDeploymentRegistry`. */
export function parseDeploymentRegistry(raw: string): DeploymentEntry[] {
  let parsed: DeploymentRegistryFile;
  try {
    parsed = JSON.parse(raw) as DeploymentRegistryFile;
  } catch {
    throw new DeploymentRegistryError("Deployment registry is not valid JSON");
  }

  if (!parsed || !Array.isArray(parsed.contracts)) {
    throw new DeploymentRegistryError("Deployment registry is missing a contracts array");
  }

  return parsed.contracts.map((entry, index) => {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      entry.name.length === 0 ||
      typeof entry.address !== "string" ||
      !/^0x[0-9a-fA-F]{40}$/.test(entry.address) ||
      typeof entry.abiVersion !== "string" ||
      entry.abiVersion.length === 0 ||
      typeof entry.chainId !== "number" ||
      !Number.isInteger(entry.chainId)
    ) {
      throw new DeploymentRegistryError(
        `Deployment registry entry ${index} is missing name, address, chainId, or abiVersion`,
      );
    }

    return {
      name: entry.name,
      address: entry.address as `0x${string}`,
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

/**
 * Resolve one deployed contract from `NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON`.
 * Returns undefined when the variable is unset so existing env-address fallbacks still apply.
 */
export function contractFromDeploymentRegistry(name: string): DeploymentEntry | undefined {
  const raw = process.env.NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON;
  if (!raw) return undefined;
  return findDeployment(parseDeploymentRegistry(raw), name);
}
