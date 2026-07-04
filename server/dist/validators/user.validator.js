"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRole = exports.updateProfile = void 0;
const joi_1 = __importDefault(require("joi"));
const constants_1 = require("../constants");
exports.updateProfile = {
    body: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(50),
    }).min(1).messages({
        'object.min': 'At least one field is required',
    }),
};
exports.updateRole = {
    params: joi_1.default.object({
        userId: joi_1.default.string().required(),
    }),
    body: joi_1.default.object({
        role: joi_1.default.string().valid(constants_1.ROLES.SUPER_ADMIN, constants_1.ROLES.ADMIN, constants_1.ROLES.MEMBER, constants_1.ROLES.GUEST).required(),
    }),
};
