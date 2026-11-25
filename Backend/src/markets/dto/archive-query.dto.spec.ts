import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ArchiveQueryDto, MAX_ARCHIVE_PAGE_SIZE } from './archive-query.dto';

/** Mirrors the global ValidationPipe in main.ts (transform + whitelist). */
const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

/** Query strings arrive as text, exactly as Express hands them to the pipe. */
function parse(query: Record<string, string>) {
  const dto = plainToInstance(ArchiveQueryDto, query);
  const errors = validateSync(dto, PIPE_OPTIONS);
  return { dto, failed: errors.map((e) => e.property) };
}

describe('ArchiveQueryDto (#1357)', () => {
  it('accepts an empty query', () => {
    expect(parse({}).failed).toEqual([]);
  });

  it('converts pagination and normalises category / outcome', () => {
    const { dto, failed } = parse({
      page: '2',
      limit: '25',
      category: '  Crypto ',
      outcome: 'YES',
      from: '2024-01-01',
      to: '2024-01-31T23:59:59.000Z',
    });
    expect(failed).toEqual([]);
    expect(dto).toMatchObject({
      page: 2,
      limit: 25,
      category: 'crypto',
      outcome: 'yes',
    });
  });

  it.each(['abc', '0', '-1', '1.5', 'Infinity', 'NaN', ''])(
    'rejects page=%p',
    (page) => {
      expect(parse({ page }).failed).toEqual(['page']);
    },
  );

  it.each(['abc', '0', '2.5', 'Infinity', String(MAX_ARCHIVE_PAGE_SIZE + 1)])(
    'rejects limit=%p',
    (limit) => {
      expect(parse({ limit }).failed).toEqual(['limit']);
    },
  );

  it('accepts limit at the maximum', () => {
    expect(parse({ limit: String(MAX_ARCHIVE_PAGE_SIZE) }).failed).toEqual([]);
  });

  it.each(['maybe', 'void', 'yes;drop'])(
    'rejects unsupported outcome=%p',
    (outcome) => {
      expect(parse({ outcome }).failed).toEqual(['outcome']);
    },
  );

  it.each(['not-a-date', '2024-13-01', '2024-02-30', '01/02/2024'])(
    'rejects from=%p',
    (from) => {
      expect(parse({ from }).failed).toEqual(['from']);
    },
  );

  it('rejects an invalid to date', () => {
    expect(parse({ to: 'tomorrow' }).failed).toEqual(['to']);
  });

  it('rejects a range where to is earlier than from', () => {
    expect(parse({ from: '2024-02-01', to: '2024-01-31' }).failed).toEqual([
      'to',
    ]);
  });

  it('accepts a single-day range and open-ended ranges', () => {
    expect(parse({ from: '2024-01-31', to: '2024-01-31' }).failed).toEqual([]);
    expect(parse({ from: '2024-01-31' }).failed).toEqual([]);
    expect(parse({ to: '2024-01-31' }).failed).toEqual([]);
  });

  it('rejects unknown query parameters', () => {
    expect(parse({ status: 'open' }).failed).toEqual(['status']);
  });

  it('rejects an overlong category', () => {
    expect(parse({ category: 'x'.repeat(65) }).failed).toEqual(['category']);
  });
});
