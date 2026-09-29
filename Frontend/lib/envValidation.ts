const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface AddressVar {
  key: string;
  value: string | undefined;
}

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const CONTRACT_ADDRESS_VARS: AddressVar[] = [
  { key: "NEXT_PUBLIC_MARKET_FACTORY_ADDRESS", value: process.env.NEXT_PUBLIC_MARKET_FACTORY_ADDRESS },
  { key: "NEXT_PUBLIC_MARKET_MAKER_ADDRESS", value: process.env.NEXT_PUBLIC_MARKET_MAKER_ADDRESS },
  { key: "NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS", value: process.env.NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS },
  { key: "NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS", value: process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS },
  { key: "NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS", value: process.env.NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS },
];

export function validateContractAddresses(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const { key, value } of CONTRACT_ADDRESS_VARS) {
    if (!value) {
      warnings.push(`${key} is not set — related features will use demo data or be disabled.`);
      continue;
    }
    if (!EVM_ADDRESS_RE.test(value)) {
      errors.push(
        `${key}="${value}" is not a valid EVM address (expected 0x followed by 40 hex characters).`,
      );
      continue;
    }
    if (value === ZERO_ADDRESS) {
      warnings.push(
        `${key} is the zero address — the contract may not be deployed yet.`,
      );
    }
  }

  if (errors.length > 0) {
    console.error(
      "[GateDelay] Invalid contract address configuration:\n" + errors.join("\n"),
    );
  }
  if (warnings.length > 0) {
    console.warn(
      "[GateDelay] Contract address warnings:\n" + warnings.join("\n"),
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
