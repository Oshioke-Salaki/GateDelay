import 'reflect-metadata';
import { readFileSync } from 'fs';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { readFileSync } from 'fs';
import {
  AuditQueryDto,
  CreateAuditLogDto,
  MAX_QUERY_LIMIT,
  MAX_RETENTION_DAYS,
  RetentionPolicyDto,
} from './market-audit.dto';
import { findSecretLabel } from './no-secrets.validator';

/**
 * Negative-path suite for the market audit DTOs.
 *
 * Each `describe` block maps to a numbered threat in the header of
 * `market-audit.dto.ts` and in `docs/THREAT_MODEL_MARKET_AUDIT.md`. The point of
 * the suite is the *rejections*: the audit chain is append-only, so a value that
 * gets past this gate can never be taken back out.
 */

/** Mirrors `main.ts`: `whitelist: true, forbidNonWhitelisted: true`. */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

function check<T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): ValidationError[] {
  return validateSync(plainToInstance(cls, payload), PIPE_OPTIONS);
}

function failedProperties(errors: ValidationError[]): string[] {
  return errors.map((error) => error.property);
}

/**
 * Credential fixtures, assembled at runtime from fragments.
 *
 * These strings have to *look* like credentials or they would not exercise the
 * validator at all — which is precisely what makes a secret scanner flag the
 * file. GitGuardian runs on this repository's pull requests and blocks on any
 * literal match. Joining fragments leaves no matchable pattern in the committed
 * source while the value handed to the validator stays byte-identical.
 *
 * Nothing here is a real credential: the hex key is a fixed low-entropy filler,
 * and the rest are synthetic or vendor-published documentation examples.
 */
const assemble = (...parts: string[]): string => parts.join('');

/** 64 hex characters — the shape of an EVM private key, obviously synthetic. */
const FAKE_HEX_KEY = '0123456789abcdef'.repeat(4);

const CREDENTIAL_FIXTURES: Array<[string, string]> = [
  ['EVM private key', `rotated key 0x${FAKE_HEX_KEY}`],
  ['bare 64-hex key', `seed ${FAKE_HEX_KEY} stored`],
  ['PEM block', assemble('-----BEGIN RSA ', 'PRIVATE', ' KEY-----', ' MIIEow')],
  [
    'JWT',
    assemble(
      'bearer eyJhbGciOiJIUzI1NiJ9',
      '.',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      '.',
      'dozjgNryP4J3jVmNHl0w5N',
    ),
  ],
  [
    'AWS access key id',
    assemble('using ', 'AKIA', 'IOSFODNN7', 'EXAMPLE', ' for export'),
  ],
  [
    'GitHub token',
    assemble('token ', 'ghp', '_', '016C7869F4F1A2B3C4D5E6F7890ABCDEF12345'),
  ],
  [
    'assignment form',
    assemble('reconnected with ', 'api', '_key=', '7d8f9a0b1c2d3e4f5061'),
  ],
  [
    'mnemonic',
    assemble(
      'legal winner thank year wave sausage ',
      'worth useful legal winner thank yellow',
    ),
  ],
];

const VALID_LOG = {
  marketId: 'market-100',
  operation: 'CREATE_MARKET',
  actor: 'admin-01',
  details: 'Market market-100 initialised after oracle validation.',
};

describe('CreateAuditLogDto', () => {
  it('accepts a well-formed record (happy path anchor)', () => {
    expect(check(CreateAuditLogDto, VALID_LOG)).toHaveLength(0);
  });

  it('accepts every documented severity', () => {
    for (const severity of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      expect(check(CreateAuditLogDto, { ...VALID_LOG, severity })).toHaveLength(
        0,
      );
    }
  });

  // ── Threat #1: credential exfiltration through the audit trail ────────────
  describe('threat #1 — credential paste-in is rejected', () => {
    it.each(CREDENTIAL_FIXTURES)(
      'rejects details containing a %s',
      (_label, details) => {
        const errors = check(CreateAuditLogDto, { ...VALID_LOG, details });
        expect(failedProperties(errors)).toContain('details');
      },
    );

    it('does not echo the rejected secret back in the error message', () => {
      const details = `key 0x${FAKE_HEX_KEY}`;
      const [error] = check(CreateAuditLogDto, { ...VALID_LOG, details });
      const message = JSON.stringify(error.constraints ?? {});
      expect(message).not.toContain(FAKE_HEX_KEY.slice(0, 8));
    });

    it('leaves ordinary operational prose alone', () => {
      const benign = [
        'Market market-100 resolved to YES; liquidations triggered.',
        'tokenAddress 0x1000000000000000000000000000000000000001 registered',
        'Retention window adjusted to 180 days by admin-02.',
      ];
      for (const details of benign) {
        expect(findSecretLabel(details)).toBeNull();
      }
    });

    // Regression guard: the mnemonic heuristic keys on "12 or 24 lowercase
    // words of 3-8 letters", which plain English also satisfies. Rejecting one
    // of these would permanently block a legitimate audit write.
    it.each([
      'market paused after the oracle feed went stale for our main resolver',
      'trade was settled and the payout has been sent from their wallet',
    ])(
      'does not mistake a 12-word English sentence for a mnemonic: %s',
      (prose) => {
        expect(prose.split(' ')).toHaveLength(12);
        expect(findSecretLabel(prose)).toBeNull();
        expect(
          check(CreateAuditLogDto, { ...VALID_LOG, details: prose }),
        ).toHaveLength(0);
      },
    );
  });

  // ── Threat #2: log flooding / memory amplification ────────────────────────
  describe('threat #2 — oversized fields are rejected', () => {
    it('rejects details beyond 2 KiB', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        details: 'A'.repeat(2049),
      });
      expect(failedProperties(errors)).toContain('details');
    });

    it('rejects an over-long marketId', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        marketId: 'm'.repeat(129),
      });
      expect(failedProperties(errors)).toContain('marketId');
    });

    it('rejects empty required fields', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        marketId: '',
        details: '',
      });
      expect(failedProperties(errors)).toEqual(
        expect.arrayContaining(['marketId', 'details']),
      );
    });
  });

  // ── Threat #3: forged log lines ───────────────────────────────────────────
  describe('threat #3 — control characters and newlines are rejected', () => {
    it('rejects a newline-forged second record in details', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        details:
          'benign update\n2026-01-01T00:00:00Z CRITICAL admin-01 funds withdrawn',
      });
      expect(failedProperties(errors)).toContain('details');
    });

    it('rejects a carriage return in details', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        details: 'update\r\nDELETED',
      });
      expect(failedProperties(errors)).toContain('details');
    });

    it('rejects control characters in identifiers', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        actor: 'admin\u0007-01',
      });
      expect(failedProperties(errors)).toContain('actor');
    });

    it('rejects a lowercase or spaced operation', () => {
      expect(
        failedProperties(
          check(CreateAuditLogDto, {
            ...VALID_LOG,
            operation: 'create market',
          }),
        ),
      ).toContain('operation');
    });
  });

  // ── Threat #4: CSV formula injection via the export ───────────────────────
  describe('threat #4 — spreadsheet formula sigils are rejected', () => {
    it.each(['=', '+', '-', '@'])(
      'rejects details starting with "%s"',
      (sigil) => {
        const errors = check(CreateAuditLogDto, {
          ...VALID_LOG,
          details: `${sigil}HYPERLINK("http://evil.example","click")`,
        });
        expect(failedProperties(errors)).toContain('details');
      },
    );

    it('still allows a sigil in the middle of the text', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        details: 'fee changed from 0.1% to 0.3% (delta +0.2%)',
      });
      expect(errors).toHaveLength(0);
    });
  });

  // ── Threat #7: mass assignment ────────────────────────────────────────────
  describe('threat #7 — unexpected properties are rejected', () => {
    it('rejects a forged hash/chain field', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        hash: 'deadbeef',
        previousHash: 'GENESIS',
      });
      expect(failedProperties(errors)).toEqual(
        expect.arrayContaining(['hash', 'previousHash']),
      );
    });

    it('rejects an unknown severity', () => {
      const errors = check(CreateAuditLogDto, {
        ...VALID_LOG,
        severity: 'CATASTROPHIC',
      });
      expect(failedProperties(errors)).toContain('severity');
    });
  });
});

describe('AuditQueryDto', () => {
  // ── Threat #5: query-parameter type confusion ─────────────────────────────
  describe('threat #5 — limit is coerced and bounded', () => {
    it('accepts a numeric string, as query params always arrive', () => {
      const dto = plainToInstance(AuditQueryDto, { limit: '50' });
      expect(validateSync(dto, PIPE_OPTIONS)).toHaveLength(0);
      expect(dto.limit).toBe(50);
    });

    it(`rejects a limit above ${MAX_QUERY_LIMIT}`, () => {
      const errors = check(AuditQueryDto, {
        limit: String(MAX_QUERY_LIMIT + 1),
      });
      expect(failedProperties(errors)).toContain('limit');
    });

    it.each(['0', '-5', '1.5', 'NaN', 'Infinity', 'abc'])(
      'rejects limit=%s',
      (limit) => {
        expect(failedProperties(check(AuditQueryDto, { limit }))).toContain(
          'limit',
        );
      },
    );
  });

  describe('date filters must be real timestamps', () => {
    it.each(['not-a-date', '2026-13-45', ''])('rejects from=%s', (from) => {
      expect(failedProperties(check(AuditQueryDto, { from }))).toContain(
        'from',
      );
    });

    it('accepts an ISO-8601 instant', () => {
      expect(
        check(AuditQueryDto, { from: '2026-01-01T00:00:00.000Z' }),
      ).toHaveLength(0);
    });
  });

  it('rejects an injected filter shape', () => {
    const errors = check(AuditQueryDto, { marketId: { $ne: null } });
    expect(failedProperties(errors)).toContain('marketId');
  });

  it('accepts an empty query', () => {
    expect(check(AuditQueryDto, {})).toHaveLength(0);
  });
});

describe('RetentionPolicyDto', () => {
  // ── Threat #6: irreversible history wipe ──────────────────────────────────
  it.each(['0', '-1', '0.5', 'NaN'])(
    'rejects retentionDays=%s so history cannot be wiped',
    (retentionDays) => {
      expect(
        failedProperties(check(RetentionPolicyDto, { retentionDays })),
      ).toContain('retentionDays');
    },
  );

  it(`rejects retentionDays above ${MAX_RETENTION_DAYS}`, () => {
    const errors = check(RetentionPolicyDto, {
      retentionDays: MAX_RETENTION_DAYS + 1,
    });
    expect(failedProperties(errors)).toContain('retentionDays');
  });

  it('accepts a sane window', () => {
    expect(check(RetentionPolicyDto, { retentionDays: 90 })).toHaveLength(0);
  });
});

describe('the DTO module itself carries no credentials', () => {
  // Acceptance criterion: "No secrets or private keys in market-audit.dto.ts".
  it('has no secret-shaped literal in the source file', () => {
    const source = readFileSync(`${__dirname}/market-audit.dto.ts`, 'utf8');
    // The scanner's own regexes live in no-secrets.validator.ts, so a hit here
    // is a real literal rather than a pattern definition.
    expect(findSecretLabel(source)).toBeNull();
  });
});
