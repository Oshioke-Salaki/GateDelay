/**
 * Request DTOs for `routes/pause.js` (#915).
 *
 * The pause endpoints are operator-only mutations on a live market: a bad
 * `reason` silently fails the service's own enum check, an unbounded `durationMs`
 * parks a market indefinitely, and free-text `notes` is echoed back to every
 * reader of `GET /pause/status/:marketId`. The schemas below make each of those
 * a 400 at the edge instead.
 *
 * Note: role/permission enforcement stays in `services/pauseService.js`
 * (`PAUSE_PERMISSIONS`); these schemas only constrain shape and size, and
 * deliberately do not duplicate the role allow-lists.
 */

const Joi = require('joi');
const { MAX_PAGE_SIZE } = require('./validateRequest');

/** `marketId` is a path segment, so it is bounded and charset-restricted. */
const marketIdParam = Joi.object({
  marketId: Joi.string().trim().min(1).max(128).required(),
});

/**
 * Operator-supplied free text. Rejects control characters (log/terminal
 * injection into the pause event log) and caps length, because the value is
 * persisted in the market's `notes` and replayed by `GET /pause/status`.
 */
// eslint-disable-next-line no-control-regex
const notes = Joi.string().trim().max(500).pattern(/^[^\x00-\x1F\x7F]+$/u);

/** Mirrors `PAUSE_REASONS` in services/pauseService.js. */
const PAUSE_REASONS = [
  'SCHEDULED_MAINTENANCE',
  'VOLATILITY_CIRCUIT_BREAKER',
  'LIQUIDITY_CRISIS',
  'SECURITY_CONCERN',
  'REGULATORY_HOLD',
  'EMERGENCY',
  'MANUAL',
];

/** Mirrors `PAUSE_STATES` in services/pauseService.js. */
const PAUSE_EVENT_TYPES = ['MARKET_PAUSED', 'MARKET_UNPAUSED', 'EMERGENCY_PAUSE', 'EMERGENCY_UNPAUSE'];

/** POST /pause/:marketId */
const pauseMarketBody = Joi.object({
  reason: Joi.string().valid(...PAUSE_REASONS).required(),
  notes: notes.optional(),
  // Auto-unpause is a scheduling primitive: bound it to 24h so a typo cannot
  // park a market longer than any plausible maintenance window.
  durationMs: Joi.number().integer().min(1).max(86_400_000).optional(),
}).unknown(false);

/** POST /pause/:marketId/unpause */
const unpauseMarketBody = Joi.object({
  notes: notes.optional(),
}).unknown(false);

/** POST /pause/:marketId/emergency and POST /pause/:marketId/emergency/lift */
const emergencyPauseBody = Joi.object({
  notes: notes.optional(),
}).unknown(false);

/**
 * GET /pause/events
 *
 * `limit` stays optional with no default: the event log is the audit trail for
 * pauses, and an absent limit has always meant "return everything" rather than
 * silently truncating to the first page of an append-only log.
 */
const pauseEventsQuery = Joi.object({
  marketId: Joi.string().trim().min(1).max(128),
  eventType: Joi.string().valid(...PAUSE_EVENT_TYPES),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE),
}).unknown(false);

module.exports = {
  PAUSE_EVENT_TYPES,
  PAUSE_REASONS,
  emergencyPauseBody,
  marketIdParam,
  pauseEventsQuery,
  pauseMarketBody,
  unpauseMarketBody,
};
