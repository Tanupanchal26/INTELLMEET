"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.verifyEmail = exports.resetPassword = exports.forgotPassword = exports.refreshToken = exports.login = exports.signup = void 0;
const joi_1 = __importDefault(require("joi"));
const common_schema_1 = require("./common.schema");
const constants_1 = require("../constants");
exports.signup = {
    body: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(50).required()
            .messages({ 'string.min': 'Name must be at least 2 characters' }),
        email: common_schema_1.email,
        password: common_schema_1.password,
        role: joi_1.default.string().valid(constants_1.ROLES.MEMBER).default(constants_1.ROLES.MEMBER),
    }),
};
exports.login = {
    body: joi_1.default.object({
        email: common_schema_1.email,
        password: joi_1.default.string().required(),
    }),
};
exports.refreshToken = {
    body: joi_1.default.object({
        refreshToken: joi_1.default.string().optional(),
    }),
};
exports.forgotPassword = {
    body: joi_1.default.object({ email: common_schema_1.email }),
};
exports.resetPassword = {
    params: joi_1.default.object({ token: joi_1.default.string().required() }),
    body: joi_1.default.object({
        password: common_schema_1.password,
        confirmPassword: joi_1.default.string()
            .valid(joi_1.default.ref('password')).required()
            .messages({ 'any.only': 'Passwords do not match' }),
    }),
};
exports.verifyEmail = {
    params: joi_1.default.object({ token: joi_1.default.string().required() }),
};
exports.changePassword = {
    body: joi_1.default.object({
        currentPassword: joi_1.default.string().required(),
        newPassword: common_schema_1.password,
        confirmPassword: joi_1.default.string()
            .valid(joi_1.default.ref('newPassword')).required()
            .messages({ 'any.only': 'Passwords do not match' }),
    }),
};
