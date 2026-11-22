/**
 * Public surface for the legacy Express request DTOs (#915).
 *
 * Import from here in `routes/*.js` rather than reaching into the individual
 * `*.dto.js` files, so adding a schema stays a one-file change.
 */

const validateRequest = require('./validateRequest');
const pauseDto = require('./pause.dto');
const rollbackDto = require('./rollback.dto');
const marketStatusDto = require('./marketStatus.dto');

module.exports = {
  ...validateRequest,
  pause: pauseDto,
  rollback: rollbackDto,
  marketStatus: marketStatusDto,
};
