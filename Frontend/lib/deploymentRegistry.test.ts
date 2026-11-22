import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DeploymentRegistryError,
  contractFromDeploymentRegistry,
  parseDeploymentRegistry,
} from "./deploymentRegistry";

const REGISTRY = JSON.stringify({
  contracts: [
    {
      name: "MarketBridge",
      address: "0x000000000000000000000000000000000000beef",
      chainId: 1,
      abiVersion: "1.0.0",
    },
  ],
});

describe("deployment registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads name, address, chain id, and abi version", () => {
    expect(parseDeploymentRegistry(REGISTRY)).toEqual([
      {
        name: "MarketBridge",
        address: "0x000000000000000000000000000000000000beef",
        chainId: 1,
        abiVersion: "1.0.0",
      },
    ]);
  });

  it("returns the named contract from the public env document", () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", REGISTRY);
    expect(contractFromDeploymentRegistry("MarketBridge")?.abiVersion).toBe("1.0.0");
  });

  it("returns undefined when the env document is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_DEPLOYMENT_REGISTRY_JSON", "");
    expect(contractFromDeploymentRegistry("MarketBridge")).toBeUndefined();
  });

  it("rejects a malformed document", () => {
    expect(() => parseDeploymentRegistry("{")).toThrow(DeploymentRegistryError);
  });
});
