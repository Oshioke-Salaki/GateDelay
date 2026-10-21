const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse an HTML date-input value as a UTC calendar day.
 *
 * Date-only strings are intentionally not interpreted in the server's local
 * timezone. The round-trip check rejects impossible dates such as February 30.
 */
function parseUtcCalendarDate(value, fieldName) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be a date in YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} must be a valid calendar date`);
  }

  return date;
}

/**
 * Convert date-only trade-history filters to a UTC half-open timestamp range.
 *
 * The selected start date is inclusive at 00:00:00 UTC. The selected end date
 * includes its full UTC calendar day and is represented by the exclusive
 * midnight boundary of the following day.
 */
function buildTradeHistoryTimestampFilter(startDate, endDate) {
  if (!startDate && !endDate) return null;

  const start = startDate ? parseUtcCalendarDate(startDate, 'startDate') : null;
  const end = endDate ? parseUtcCalendarDate(endDate, 'endDate') : null;

  if (start && end && start.getTime() > end.getTime()) {
    throw new Error('startDate must be on or before endDate');
  }

  const filter = {};
  if (start) filter.$gte = start;
  if (end) {
    filter.$lt = new Date(end.getTime() + MILLISECONDS_PER_DAY);
  }

  return filter;
}

module.exports = { buildTradeHistoryTimestampFilter };
