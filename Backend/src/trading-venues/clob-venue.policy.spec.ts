import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { assertConfiguredClobVenue } from './clob-venue.policy';

describe('configured CLOB venue policy', () => {
  const originalVenues = process.env.CLOB_VENUES;

  afterEach(() => {
    if (originalVenues === undefined) {
      delete process.env.CLOB_VENUES;
    } else {
      process.env.CLOB_VENUES = originalVenues;
    }
  });

  it('fails closed when no CLOB venues are configured', () => {
    delete process.env.CLOB_VENUES;

    expect(() => assertConfiguredClobVenue('spot', 'ETH-USDT')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('accepts a pair only for its configured CLOB venue', () => {
    process.env.CLOB_VENUES = JSON.stringify([
      { id: 'spot', pairs: ['ETH-USDT'] },
    ]);

    expect(assertConfiguredClobVenue('spot', 'eth-usdt')).toEqual({
      venueId: 'spot',
      pair: 'ETH-USDT',
    });
  });

  it('rejects unconfigured venues and pairs', () => {
    process.env.CLOB_VENUES = JSON.stringify([
      { id: 'spot', pairs: ['ETH-USDT'] },
    ]);

    expect(() =>
      assertConfiguredClobVenue('prediction-market', 'ETH-USDT'),
    ).toThrow(BadRequestException);
    expect(() => assertConfiguredClobVenue('spot', 'market-123')).toThrow(
      BadRequestException,
    );
  });
});
