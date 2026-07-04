"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMessages = exports.reaction = exports.editMessage = exports.sendMessage = exports.channelParam = exports.updateChannel = exports.createChannel = void 0;
const joi_1 = __importDefault(require("joi"));
const common_schema_1 = require("./common.schema");
exports.createChannel = {
    params: joi_1.default.object({ teamId: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(80).required(),
        description: joi_1.default.string().max(300).allow('').optional(),
        topic: joi_1.default.string().max(200).allow('').optional(),
        type: joi_1.default.string().valid('public', 'private', 'announcement').default('public'),
    }),
};
exports.updateChannel = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(80),
        description: joi_1.default.string().max(300).allow(''),
        topic: joi_1.default.string().max(200).allow(''),
    }).min(1),
};
exports.channelParam = common_schema_1.idParam;
exports.sendMessage = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        content: joi_1.default.string().min(1).max(4000).required(),
        mentions: joi_1.default.array().items(common_schema_1.mongoId).optional(),
        attachments: joi_1.default.array().items(joi_1.default.object({
            url: joi_1.default.string().uri().required(),
            name: joi_1.default.string().required(),
            mimeType: joi_1.default.string().optional(),
            size: joi_1.default.number().optional(),
        })).optional(),
        parentId: common_schema_1.mongoId.optional(),
    }),
};
exports.editMessage = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required(), msgId: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        content: joi_1.default.string().min(1).max(4000).required(),
    }),
};
exports.reaction = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required(), msgId: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        emoji: joi_1.default.string().min(1).max(10).required(),
    }),
};
exports.listMessages = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    query: common_schema_1.pagination.keys({
        limit: joi_1.default.number().integer().min(1).max(100).default(50),
        before: joi_1.default.string().isoDate().optional(),
    }),
};
