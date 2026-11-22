/**
 * legacy-config.spec.ts
 *
 * Tests for the typed config validation layer introduced in config/legacy.js.
 * Covers parseField type coercion and buildConfig error aggregation.
 *
 * Closes #613
 */

// We test the JS module via require() since it lives outside src/
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseField, buildConfig } = require('../config/legacy.js');

describe('parseField', () => {
  it('returns defaultValue when env var is missing and not required', () => {
    expect(
      parseField('MISSING_VAR', undefined, {
        type: 'string',
        required: false,
        defaultValue: 'default',
      }),
    ).toBe('default');
  });

  it('throws when a required env var is missing', () => {
    expect(() =>
      parseField('REQUIRED_VAR', undefined, { type: 'string', required: true }),
    ).toThrow('Required environment variable "REQUIRED_VAR" is not set.');
  });

  it('coerces a valid number string', () => {
    expect(parseField('NUM_VAR', '42', { type: 'number' })).toBe(42);
  });

  it('throws on invalid number string', () => {
    expect(() =>
      parseField('NUM_VAR', 'not-a-number', { type: 'number' }),
    ).toThrow('must be a number');
  });

  it('coerces a valid port string', () => {
    expect(parseField('PORT_VAR', '3000', { type: 'port' })).toBe(3000);
  });

  it('throws on out-of-range port', () => {
    expect(() => parseField('PORT_VAR', '99999', { type: 'port' })).toThrow(
      'must be a valid port',
    );
  });

  it('coerces boolean "true"', () => {
    expect(parseField('BOOL_VAR', 'true', { type: 'boolean' })).toBe(true);
  });

  it('coerces boolean "0"', () => {
    expect(parseField('BOOL_VAR', '0', { type: 'boolean' })).toBe(false);
  });

  it('throws on invalid boolean value', () => {
    expect(() => parseField('BOOL_VAR', 'yes', { type: 'boolean' })).toThrow(
      'must be "true"/"false"/"1"/"0"',
    );
  });

  it('accepts a valid URL string', () => {
    const result = parseField('URL_VAR', 'https://example.com', {
      type: 'url',
    });
    expect(result).toContain('https://example.com');
  });

  it('throws on invalid URL', () => {
    expect(() => parseField('URL_VAR', 'not-a-url', { type: 'url' })).toThrow(
      'must be a valid URL',
    );
  });

  it('accepts a valid email string', () => {
    expect(parseField('EMAIL_VAR', 'user@example.com', { type: 'email' })).toBe(
      'user@example.com',
    );
  });

  it('throws on invalid email', () => {
    expect(() =>
      parseField('EMAIL_VAR', 'not-an-email', { type: 'email' }),
    ).toThrow('must be a valid email address');
  });
});

describe('buildConfig', () => {
  it('returns validated values when all env vars are present', () => {
    const schema = {
      TEST_PORT: { type: 'port' as const, required: false, defaultValue: 8080 },
      TEST_HOST: {
        type: 'string' as const,
        required: false,
        defaultValue: 'localhost',
      },
    };
    const result = buildConfig(schema);
    expect(result.TEST_PORT).toBe(8080);
    expect(result.TEST_HOST).toBe('localhost');
  });

  it('aggregates multiple validation errors and throws once', () => {
    const original = process.env.FORCE_INVALID_PORT;
    process.env.FORCE_INVALID_PORT = 'bad';
    process.env.FORCE_INVALID_NUM = 'bad';

    const schema = {
      FORCE_INVALID_PORT: { type: 'port' as const, required: false },
      FORCE_INVALID_NUM: { type: 'number' as const, required: false },
    };

    expect(() => buildConfig(schema)).toThrow(
      'Configuration validation failed',
    );

    delete process.env.FORCE_INVALID_PORT;
    delete process.env.FORCE_INVALID_NUM;
    if (original !== undefined) process.env.FORCE_INVALID_PORT = original;
  });
});
