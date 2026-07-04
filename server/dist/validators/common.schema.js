"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.idParam = exports.pagination = exports.email = exports.password = exports.mongoId = void 0;
const joi_1 = __importDefault(require("joi"));
exports.mongoId = joi_1.default.string().hex().length(24);
exports.password = joi_1.default.string()
    .min(8)
    .max(64)
    .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.max': 'Password must not exceed 64 characters',
})
    .required();
exports.email = joi_1.default.string().email().lowercase().required();
exports.pagination = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
});
exports.idParam = { params: joi_1.default.object({ id: exports.mongoId.required() }) };
