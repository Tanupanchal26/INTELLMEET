/**
 * Re-exports ApiResponse so all code uses the single canonical envelope.
 * The old inline sendSuccess/sendError helpers used a different schema
 * and have been removed to eliminate envelope inconsistency.
 */
export { ApiResponse as default, ApiResponse } from '../../utils/ApiResponse';
export type { PaginationMeta } from '../../utils/ApiResponse';
