import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

/** Runtime allowlist shared by the off-chain matching adapters. */
export interface ConfiguredClobVenue {
  id: string;
  pairs: string[];
}

export interface ConfiguredClobVenuePair {
  venueId: string;
  pair: string;
}

function readConfiguredClobVenues(): ConfiguredClobVenue[] {
  const raw = process.env.CLOB_VENUES?.trim();
  if (!raw) {
    throw new ServiceUnavailableException(
      'Off-chain matching is disabled because no CLOB venues are configured',
    );
  }

  let venues: unknown;
  try {
    venues = JSON.parse(raw);
  } catch {
    throw new ServiceUnavailableException(
      'CLOB_VENUES must contain a valid JSON array',
    );
  }

  if (!Array.isArray(venues) || venues.length === 0) {
    throw new ServiceUnavailableException(
      'CLOB_VENUES must configure at least one venue',
    );
  }

  const parsedVenues: ConfiguredClobVenue[] = [];
  const seenIds = new Set<string>();
  for (const venue of venues) {
    if (
      !venue ||
      typeof venue !== 'object' ||
      !('id' in venue) ||
      typeof venue.id !== 'string' ||
      venue.id.trim() === '' ||
      !('pairs' in venue) ||
      !Array.isArray(venue.pairs) ||
      venue.pairs.length === 0 ||
      !venue.pairs.every(
        (pair: unknown) => typeof pair === 'string' && pair.trim() !== '',
      ) ||
      seenIds.has(venue.id)
    ) {
      throw new ServiceUnavailableException(
        'Each CLOB_VENUES entry must have a unique id and non-empty string pairs',
      );
    }
    const id = venue.id.trim();
    if (seenIds.has(id)) {
      throw new ServiceUnavailableException(
        'Each CLOB_VENUES entry must have a unique id and non-empty string pairs',
      );
    }
    seenIds.add(id);
    parsedVenues.push({
      id,
      pairs: venue.pairs.map(
        (pair: string) => pair.trim().toUpperCase(),
      ),
    });
  }

  return parsedVenues;
}

export function getConfiguredClobVenuePairs(): ConfiguredClobVenuePair[] {
  return readConfiguredClobVenues().flatMap((venue) =>
    venue.pairs.map((pair) => ({ venueId: venue.id, pair })),
  );
}

export function isConfiguredClobVenue(venueId?: string, pair?: string): boolean {
  if (!venueId || !pair) return false;
  const normalizedVenueId = venueId.trim();
  const normalizedPair = pair.trim().toUpperCase();
  return getConfiguredClobVenuePairs().some(
    (venue) =>
      venue.venueId === normalizedVenueId && venue.pair === normalizedPair,
  );
}

export function assertConfiguredClobVenue(
  venueId: string,
  pair: string,
): { venueId: string; pair: string } {
  const normalizedVenueId = venueId?.trim();
  const normalizedPair = pair?.trim().toUpperCase();
  if (!normalizedVenueId || !normalizedPair) {
    throw new BadRequestException('venueId and pair are required for CLOB orders');
  }

  if (!isConfiguredClobVenue(normalizedVenueId, normalizedPair)) {
    throw new BadRequestException(
      `CLOB venue "${normalizedVenueId}" and pair "${normalizedPair}" are not configured`,
    );
  }

  return { venueId: normalizedVenueId, pair: normalizedPair };
}
