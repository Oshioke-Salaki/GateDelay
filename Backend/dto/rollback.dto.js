/**
 * Request DTOs for `routes/rollback.js` (#915).
 *
 * `POST /api/rollback/request` and `/execute` are unauthenticated and can move
 * real funds, so their payloads are the ones most worth pinning down. Before
 * these schemas the handler spread `req.body` straight into
 * `rollbackService.requestRollback`, which meant:
 *
 *   * `operationType` bypassed the service's allow-list check only when it was
 *     absent (`!operationType` threw, but a non-string object did not), and
 *   * `snapshotBlock` reached `BigInt(snapshotBlock)` untyped — an object threw
 *     a 500, a fractional number silently truncated, a negative number was
 *     accepted and only rejected later by the "future block" comparison.
 *
 * The schemas normalise all of that to the declared types and reject the rest.
 * Authentication for these routes is a separate gap and is not addressed here.
 */

const Joi = require('joi');
const { paginationQuery } = require('./validateRequest');

/** Mirrors `validOperations` in services/rollbackService.js. */
const ROLLBACK_OPERATION_TYPES = ['trade', 'liquidity', 'resolution', 'market_creation'];

/** Mirrors the `status` enum on the RollbackHistory schema. */
const ROLLBACK_STATUSES = [
  'pending',
  'validating',
  'executing',
  'completed',
  'failed',
  'rejected',
];

/** Ids this service mints (`rb_<epoch ms>`) plus any operator-supplied prefix. */
const rollbackIdParam = Joi.object({
  rollbackId: Joi.string().trim().min(1).max(64).required(),
});

/** Shared by POST /rollback/request and POST /rollback/validate. */
const rollbackRequestBody = Joi.object({
  marketId: Joi.string().trim().min(1).max(128).required(),
  operationType: Joi.string().valid(...ROLLBACK_OPERATION_TYPES).required(),
  reason: Joi.string().trim().min(1).max(500),
  initiatedBy: Joi.string().trim().min(1).max(128),
  // Block numbers are non-negative integers; a float or a negative value is
  // rejected here rather than being coerced by BigInt() or silently truncated.
  snapshotBlock: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),
}).unknown(false);

/**
 * POST /rollback/validate accepts the same shape but must not require
 * `initiatedBy`, since validation is a read-only pre-flight check. Kept as an
 * alias so the two endpoints cannot drift apart.
 */
const rollbackValidateBody = rollbackRequestBody.fork('initiatedBy', (schema) =>
  schema.optional(),
);

/** GET /rollback/history */
const rollbackHistoryQuery = Joi.object({
  marketId: Joi.string().trim().min(1).max(128),
  status: Joi.string().valid(...ROLLBACK_STATUSES),
  limit: paginationQuery.limit,
  page: paginationQuery.page,
}).unknown(false);

module.exports = {
  ROLLBACK_OPERATION_TYPES,
  ROLLBACK_STATUSES,
  rollbackHistoryQuery,
  rollbackIdParam,
  rollbackRequestBody,
  rollbackValidateBody,
};
