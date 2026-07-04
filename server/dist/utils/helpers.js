"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clean = exports.pick = exports.slugify = exports.generateRoomCode = exports.paginate = void 0;
const constants_1 = require("../constants");
/**
 * Applies skip/limit to a Mongoose query based on page & limit params.
 * Returns { skip, limit, page } for use in paginated responses.
 */
const paginate = (query, { page, limit } = {}) => {
    const p = Math.max(1, parseInt(String(page ?? ''), 10) || constants_1.PAGINATION.DEFAULT_PAGE);
    const l = Math.min(constants_1.PAGINATION.MAX_LIMIT, Math.max(1, parseInt(String(limit ?? ''), 10) || constants_1.PAGINATION.DEFAULT_LIMIT));
    return {
        query: query.skip((p - 1) * l).limit(l),
        page: p,
        limit: l,
    };
};
exports.paginate = paginate;
/** Generates a short uppercase room code, e.g. "A3FX92" */
const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
exports.generateRoomCode = generateRoomCode;
/** Creates a URL-safe slug from a string, e.g. "Foo Bar!" → "foo-bar" */
const slugify = (str) => str.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
exports.slugify = slugify;
/**
 * Picks only the specified keys from an object.
 * Useful for filtering request bodies before DB writes.
 */
const pick = (obj, keys) => keys.reduce((acc, key) => {
    if (key in obj)
        acc[String(key)] = obj[key];
    return acc;
}, {});
exports.pick = pick;
/** Strips undefined values from an object (safe for MongoDB $set) */
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
exports.clean = clean;
exports.default = { paginate, generateRoomCode, slugify, pick, clean };
