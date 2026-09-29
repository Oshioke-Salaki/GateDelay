/**
 * Type declarations for the shared CommonJS pagination helpers
 * (`Backend/utils/pagination.js`).
 *
 * The runtime implementation is plain CommonJS so that `routes/*.js` and
 * `services/*.js` can require it directly. This declaration file exists only so
 * the Nest/TypeScript half of the backend — which imports the same helpers, per
 * `src/common/http-error-envelope.filter.ts` importing `utils/errorEnvelope` —
 * sees the real contract instead of `any`. The `meta` block is what makes
 * markets, trades, audit logs and notifications paged uniformly (#916), so it
 * is worth typing rather than casting at every call site.
 */

/** Metadata attached to every paginated list response. */
export interface PaginationMeta {
  /** 1-based page number actually served. */
  page: number;
  /** Page size after clamping. */
  limit: number;
  /** Absolute index of the first row on this page. */
  offset: number;
  /** Rows present on this page; lower than `limit` on the final page. */
  count: number;
  /** Rows matching the filters across all pages. */
  total: number;
  /** `0` when nothing matches, so an empty list reads as "no pages". */
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface NormalizePaginationInput {
  page?: number | string;
  limit?: number | string;
  /** Page size used when `limit` is absent or unusable. Defaults to 20. */
  defaultLimit?: number;
  /** Ceiling applied to `limit`. Defaults to 200. */
  maxLimit?: number;
}

export interface NormalizePagination {
  page: number;
  limit: number;
  offset: number;
  /** Alias of `offset`, for call sites that read as Mongo `.skip()`. */
  skip: number;
}

export interface BuildPaginationMetaInput {
  total: number;
  count: number;
  page: number;
  limit: number;
  offset?: number;
}

export const DEFAULT_LIMIT: number;
export const DEFAULT_PAGE: number;
export const MAX_LIMIT: number;

export function normalizePagination(
  input?: NormalizePaginationInput,
): NormalizePagination;

export function buildPaginationMeta(
  input: BuildPaginationMetaInput,
): PaginationMeta;

export function paginate<T>(
  items: T[],
  input?: NormalizePaginationInput,
): { items: T[]; meta: PaginationMeta };
