"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = exports.default = void 0;
/**
 * Re-exports ApiResponse so all code uses the single canonical envelope.
 * The old inline sendSuccess/sendError helpers used a different schema
 * and have been removed to eliminate envelope inconsistency.
 */
var ApiResponse_1 = require("../../utils/ApiResponse");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return ApiResponse_1.ApiResponse; } });
Object.defineProperty(exports, "ApiResponse", { enumerable: true, get: function () { return ApiResponse_1.ApiResponse; } });
