"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const asyncHandler = (fn) => (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
    return undefined;
};
exports.default = asyncHandler;
module.exports = asyncHandler;
module.exports.default = asyncHandler;
