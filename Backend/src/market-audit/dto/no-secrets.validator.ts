import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Threat: credential exfiltration through the audit trail.
 *
 * Audit records are append-only, hash-chained, exported to CSV and read by
 * support staff, so anything that lands in a free-text field is effectively
 * permanent and widely readable. A caller that pastes a deployer key or an API
 * token into `details` turns the audit log into a credential store that we can
 * never redact without breaking the integrity chain (see `verifyIntegrity`).
 *
 * These patterns reject the credential shapes this codebase actually handles
 * (EVM/PEM keys, BIP-39 mnemonics, and the provider tokens listed in
 * `Backend/.env.example`). This is a guard rail, not a secret scanner: it
 * blocks obvious paste-ins, it cannot catch every encoding.
 */
const SECRET_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  // EVM private key, with or without the 0x prefix.
  { label: 'hex private key', pattern: /\b(?:0x)?[0-9a-fA-F]{64}\b/ },
  // PEM-encoded key material.
  {
    label: 'PEM private key',
    pattern: /-{2,}\s*BEGIN[ A-Z]*PRIVATE KEY\s*-{2,}/i,
  },
  // JSON Web Token (three base64url segments).
  {
    label: 'JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
  },
  // AWS access key id (aws-sdk is a backend dependency).
  { label: 'AWS access key id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  // Vendor-prefixed tokens: GitHub, Stripe, Slack, Groq.
  {
    label: 'vendor API token',
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]{16,}|xox[abprs]-[A-Za-z0-9-]{10,})\b/,
  },
  // `secret=...` / `"private_key": "..."` style assignments. `token` on its own
  // is deliberately excluded so that `tokenAddress: 0x...` is not flagged here.
  {
    label: 'credential assignment',
    pattern:
      /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|refresh[_-]?token|private[_-]?key|passwd|password|mnemonic|seed[_-]?phrase|secret)\b\s*[:=]\s*["']?\S{8,}/i,
  },
];

/** Every BIP-39 English word is 3-8 lowercase letters. */
const MNEMONIC_WORD = /^[a-z]{3,8}$/;

/**
 * Common English function words that are **not** in the BIP-39 English wordlist
 * (verified against `bip39`'s english.json, which the project already depends
 * on). A 12- or 24-word lowercase phrase containing any of them is prose, not a
 * seed phrase.
 *
 * Without this, an ordinary audit note reading "market paused after the oracle
 * feed went stale for our resolver" is twelve lowercase 3-8 letter words and
 * would be rejected as a mnemonic — a false positive that permanently blocks a
 * legitimate write. Words that *are* in the wordlist (`this`, `that`, `when`,
 * `all`, `just`, `only`, `have`, `there` …) are deliberately excluded from this
 * list, since their presence proves nothing either way.
 */
const NOT_IN_BIP39 = new Set([
  'after',
  'and',
  'are',
  'been',
  'being',
  'both',
  'but',
  'could',
  'did',
  'does',
  'doing',
  'done',
  'due',
  'each',
  'for',
  'from',
  'got',
  'had',
  'has',
  'having',
  'hence',
  'her',
  'him',
  'his',
  'how',
  'however',
  'its',
  'may',
  'most',
  'new',
  'nor',
  'not',
  'onto',
  'ought',
  'our',
  'out',
  'per',
  'said',
  'set',
  'shall',
  'she',
  'should',
  'some',
  'than',
  'the',
  'their',
  'them',
  'these',
  'those',
  'thus',
  'via',
  'was',
  'were',
  'which',
  'while',
  'who',
  'whom',
  'whose',
  'why',
  'with',
  'would',
  'yet',
  'your',
]);

function looksLikeMnemonic(value: string): boolean {
  const words = value.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) return false;
  if (!words.every((word) => MNEMONIC_WORD.test(word))) return false;
  return !words.some((word) => NOT_IN_BIP39.has(word));
}

export function findSecretLabel(value: string): string | null {
  for (const { label, pattern } of SECRET_PATTERNS) {
    if (pattern.test(value)) return label;
  }
  return looksLikeMnemonic(value) ? 'BIP-39 mnemonic' : null;
}

@ValidatorConstraint({ name: 'containsNoSecrets', async: false })
export class ContainsNoSecretsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return true;
    return findSecretLabel(value) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    // The offending value is never echoed back — an error response is one more
    // place a leaked credential would be written down.
    return `${args.property} appears to contain credential material and was rejected`;
  }
}

export function ContainsNoSecrets(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: ContainsNoSecretsConstraint,
    });
  };
}
