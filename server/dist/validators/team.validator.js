"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMemberRole = exports.inviteByEmail = exports.inviteMember = exports.memberParam = exports.teamParam = exports.updateTeam = exports.createTeam = void 0;
const joi_1 = __importDefault(require("joi"));
const common_schema_1 = require("./common.schema");
exports.createTeam = {
    body: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(80).required(),
        description: joi_1.default.string().max(500).allow('').optional(),
        avatar: joi_1.default.string().uri().allow('').optional(),
        isPrivate: joi_1.default.boolean().default(false),
        settings: joi_1.default.object({
            allowGuestInvite: joi_1.default.boolean(),
            notifyOnMessage: joi_1.default.boolean(),
        }).optional(),
    }),
};
exports.updateTeam = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        name: joi_1.default.string().trim().min(2).max(80),
        description: joi_1.default.string().max(500).allow(''),
        avatar: joi_1.default.string().uri().allow(''),
        isPrivate: joi_1.default.boolean(),
        settings: joi_1.default.object({
            allowGuestInvite: joi_1.default.boolean(),
            notifyOnMessage: joi_1.default.boolean(),
        }),
    }).min(1),
};
exports.teamParam = common_schema_1.idParam;
exports.memberParam = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required(), userId: common_schema_1.mongoId.required() }),
};
exports.inviteMember = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        userId: common_schema_1.mongoId.required(),
        role: joi_1.default.string().valid('admin', 'member', 'guest').default('member'),
    }),
};
exports.inviteByEmail = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        role: joi_1.default.string().valid('admin', 'member', 'guest').default('member'),
    }),
};
exports.updateMemberRole = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required(), userId: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        role: joi_1.default.string().valid('admin', 'member', 'guest').required(),
    }),
};
