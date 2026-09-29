/**
 * Shared request-validation harness for the legacy Express half of the
 * backend (#915).
 *
 * The NestJS half validates payloads with `class-validator` through the global
 * `ValidationPipe` (src/main.ts). `routes/*.js` sits outside that pipe, so
 * every handler used to read `req.body` / `req.query` raw and let malformed
 * input reach a service — where the only backstop was a thrown `TypeError`
 * surfacing as a 500.
 *
 * `validateRequest` closes that gap: it runs the payload through a Joi schema,
 * answers 400 with a field-level error list on failure, and otherwise replaces
 * the raw value with Joi's coerced/validated output so downstream handlers
 * always see the declared types (e.g. `limit` as a number, not `"20"`).
 *
 * Schemas are plain Joi objects in the sibling `*.dto.js` files and are
 * exported through `Backend/dto/index.js`.
 */

const Joi = require('joi');

/** Never let a caller ask for an unbounded slice from a list endpoint. */
const MAX_PAGE_SIZE = 200;

/** Shared positive-integer page size for `?page` / `?limit` query pairs. */
const paginationQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(50),
};

/**
 * Build the `code` used for validation failures. Paired with the per-route
 * `code` the caller passes, so responses stay attributable to their endpoint.
 *
 * @param {string} endpoint
 * @returns {string}
 */
function validationCode(endpoint) {
  return endpoint ? `VALIDATION_ERROR:${endpoint}` : 'VALIDATION_ERROR';
}

/**
 * @typedef {object} ValidationSchemas
 * @property {Joi.ObjectSchema} [body]
 * @property {Joi.ObjectSchema} [query]
 * @property {Joi.ObjectSchema} [params]
 */

/**
 * Build Express middleware that validates one or more request segments.
 *
 * Joi defaults to `stripUnknown: false`, but an allow-listed schema with
 * `unknown(false)` is what makes this a real boundary: unlisted fields are
 * rejected rather than forwarded to services, which is the same
 * mass-assignment protection `forbidNonWhitelisted` gives the Nest side.
 *
 * @param {ValidationSchemas} schemas
 * @param {string} [endpoint] - Label used in the error `code`.
 * @returns {import('express').RequestHandler}
 */
function validateRequest(schemas, endpoint) {
  return function validateRequestMiddleware(req, res, next) {
    for (const segment of ['params', 'query', 'body']) {
      const schema = schemas[segment];
      if (!schema) continue;

      const { error, value } = schema.validate(req[segment], {
        abortEarly: false,
        convert: true,
        stripUnknown: false,
      });

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Request validation failed',
          code: validationCode(endpoint),
          errors: error.details.map((detail) => ({
            field: detail.path.join('.') || segment,
            message: detail.message,
          })),
        });
      }

      // The coerced output is published under `req.validated.<segment>` rather
      // than written back over `req.query` / `req.params`: `req.query` is
      // getter-only from Express 5 on, and a single explicit name keeps
      // handlers reading the validated value the same way on every version.
      req.validated = req.validated || {};
      req.validated[segment] = value;
    }

    return next();
  };
}

module.exports = {
  MAX_PAGE_SIZE,
  paginationQuery,
  validateRequest,
  validationCode,
};
