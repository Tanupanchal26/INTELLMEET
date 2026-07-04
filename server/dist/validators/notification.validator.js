"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifParam = exports.listNotifications = void 0;
const joi_1 = __importDefault(require("joi"));
const common_schema_1 = require("./common.schema");
exports.listNotifications = {
    query: common_schema_1.pagination.keys({
        unreadOnly: joi_1.default.boolean().default(false),
    }),
};
exports.notifParam = common_schema_1.idParam;
