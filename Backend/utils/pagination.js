/**
 * Shared pagination helpers for both halves of the backend (#916).
 *
 * Before this module every list endpoint re-derived its own `Math.max(1, ...)` /
 * `Math.ceil(total / limit)` arithmetic and named the result differently —
 * `totalPages` in routes/trades.js, `pages` in services/auditTrail.js, nothing
 * at all in the Nest services. Clients could not page uniformly across
 * markets, trades, audit logs and notifications, and an unclamped `?limit=` was
 * accepted verbatim on several of them.
 *
 * `normalizePagination` is the single clamp point; `buildPaginationMeta` is the
 * single metadata shape. Both are plain CommonJS with no framework imports, so
 * `routes/*.js` and `services/*.js` can use them directly and TypeScript can
 * `import` them the same way `src/common/http-error-envelope.filter.ts` already
 * imports `utils/errorEnvelope`.
 */

/** Page requested when the caller does not supply one. */
const DEFAULT_PAGE = 1;

/** Items returned when the caller does not supply a limit. */
const DEFAULT_LIMIT = 20;

/**
 * Hard ceiling on a single page. A list endpoint that will happily serialise
 * 100k rows is a memory-exhaustion primitive, not a feature.
 */
const MAX_LIMIT = 200;

/**
 * Coerce arbitrary caller input (query strings, query params, DTO values) into
 * safe pagination values.
 *
 * Clamping is deliberate rather than rejecting: `?page=0` and `?limit=99999`
 * are mistakes, and answering 400 for them would break clients that already
 * send the defaults. Values are floored to whole numbers because a fractional
 * page silently skipping rows is worse than rounding.
 *
 * @param {object} [input]
 * @param {number|string} [input.page]
 * @param {number|string} [input.limit]
 * @param {number} [input.defaultLimit]
 * @param {number} [input.maxLimit]
 * @returns {{ page: number, limit: number, offset: number, skip: number }}
 */
function normalizePagination(input = {}) {
  const defaultLimit = Number.isFinite(Number(input.defaultLimit))
    ? Math.floor(Number(input.defaultLimit))
    : DEFAULT_LIMIT;
  const maxLimit = Number.isFinite(Number(input.maxLimit))
    ? Math.floor(Number(input.maxLimit))
    : MAX_LIMIT;

  const requestedLimit = Math.floor(Number(input.limit));
  const limit = Math.min(
    Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : defaultLimit),
    Math.max(1, maxLimit),
  );

  const requestedPage = Math.floor(Number(input.page));
  const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : DEFAULT_PAGE);

  const offset = (page - 1) * limit;

  return { page, limit, offset, skip: offset };
}

/**
 * Build the pagination metadata attached to list responses.
 *
 * `count` is how many items this page actually holds, which differs from
 * `limit` on the last page — clients that render "showing 1-20 of 43" need it.
 * An empty result set reports `totalPages: 0` rather than `1`, so "page 1 of 0"
 * reads correctly as "no pages".
 *
 * @param {object} input
 * @param {number} input.total - Total matching rows across all pages.
 * @param {number} input.count - Rows on this page.
 * @param {number} input.page
 * @param {number} input.limit
 * @param {number} [input.offset]
 * @returns {{
 *   page: number, limit: number, offset: number, count: number, total: number,
 *   totalPages: number, hasNextPage: boolean, hasPrevPage: boolean,
 * }}
 */
function buildPaginationMeta({ total, count, page, limit, offset }) {
  const safeLimit = Math.max(1, Math.floor(Number(limit) || DEFAULT_LIMIT));
  const safePage = Math.max(1, Math.floor(Number(page) || DEFAULT_PAGE));
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));
  const totalPages = Math.ceil(safeTotal / safeLimit);

  return {
    page: safePage,
    limit: safeLimit,
    offset: offset === undefined ? (safePage - 1) * safeLimit : offset,
    count: safeCount,
    total: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1 && safeTotal > 0,
  };
}

/**
 * Slice an in-memory collection and report the metadata for that slice.
 *
 * The in-memory registries (MarketResolverService, MarketAuditService,
 * NotificationService) hold their rows in a Map, so there is no cursor to hand
 * to the database — this is the equivalent for them.
 *
 * @template T
 * @param {T[]} items
 * @param {object} [input] - Same shape as normalizePagination.
 * @returns {{ items: T[], meta: ReturnType<typeof buildPaginationMeta> }}
 */
function paginate(items, input = {}) {
  const { page, limit, offset, skip } = normalizePagination(input);
  const all = Array.isArray(items) ? items : [];
  const pageItems = all.slice(skip, skip + limit);

  return {
    items: pageItems,
    meta: buildPaginationMeta({
      total: all.length,
      count: pageItems.length,
      page,
      limit,
      offset,
    }),
  };
}

module.exports = {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  buildPaginationMeta,
  normalizePagination,
  paginate,
};
