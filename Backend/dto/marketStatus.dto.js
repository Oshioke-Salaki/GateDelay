/**
 * Request DTOs for `routes/status.js` (#915).
 *
 * `POST /status/:marketId/toggle` is the only write on this router and it drives
 * both the persisted `MarketStatus` record and the `market:status:changes`
 * pub/sub broadcast. Its body check used to be `if (!status)`, which accepted
 * any truthy value; the enum below matches the `MarketStatusSchema.status`
 * allow-list so an unknown state can never reach MongoDB or a subscriber.
 *
 * `GET /status/:marketId/history` clamps `limit` by hand today; the schema makes
 * the bound declarative and adds the missing `page` floor.
 */

const Joi = require('joi');
const { paginationQuery } = require('./validateRequest');

/** Mirrors the `status` enum in services/statusService.js (MarketStatusSchema). */
const MARKET_STATUSES = ['ACTIVE', 'PAUSED', 'MAINTENANCE', 'OFFLINE'];

const marketIdParam = Joi.object({
  marketId: Joi.string().trim().min(1).max(128).required(),
});

/** Mirrors the `fromStatus` / `toStatus` enums on MarketStatusHistorySchema. */
const marketStatusHistoryQuery = Joi.object({
  limit: paginationQuery.limit,
  page: paginationQuery.page,
  fromStatus: Joi.string().valid(...MARKET_STATUSES),
  toStatus: Joi.string().valid(...MARKET_STATUSES),
}).unknown(false);

/** POST /status/:marketId/toggle */
const marketStatusToggleBody = Joi.object({
  status: Joi.string().valid(...MARKET_STATUSES).required(),
  // Broadcast to every subscriber of `market:status:changes` and stored on the
  // record, so cap the size and reject control characters.
// eslint-disable-next-line no-control-regex
  notes: Joi.string().trim().max(500).pattern(/^[^\x00-\x1F\x7F]+$/u).optional(),
}).unknown(false);

module.exports = {
  MARKET_STATUSES,
  marketIdParam,
  marketStatusHistoryQuery,
  marketStatusToggleBody,
};
