"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertNote = exports.respondToInvite = exports.inviteParticipants = exports.listMeetings = exports.getMeeting = exports.updateMeeting = exports.createMeeting = void 0;
const joi_1 = __importDefault(require("joi"));
const common_schema_1 = require("./common.schema");
const constants_1 = require("../constants");
exports.createMeeting = {
    body: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(120).required(),
        description: joi_1.default.string().max(1000).allow('').optional(),
        scheduledAt: joi_1.default.date().iso().optional(),
        maxDuration: joi_1.default.number().integer().min(5).max(480).default(60),
        participants: joi_1.default.array().items(common_schema_1.mongoId).max(100).optional(),
        invitees: joi_1.default.array().items(joi_1.default.object({ email: joi_1.default.string().email() })).optional(),
        team: common_schema_1.mongoId.optional(),
        agenda: joi_1.default.array().items(joi_1.default.object({
            title: joi_1.default.string().max(200).required(),
            duration: joi_1.default.number().min(1).default(5),
            order: joi_1.default.number().default(0),
        })).optional(),
        isRecurring: joi_1.default.boolean().optional(),
        recurrence: joi_1.default.when('isRecurring', {
            is: true,
            then: joi_1.default.object({
                frequency: joi_1.default.string().valid('daily', 'weekly', 'biweekly', 'monthly').required(),
                until: joi_1.default.date().iso().optional(),
            }),
        }),
        settings: joi_1.default.object({
            waitingRoom: joi_1.default.boolean(),
            muteOnEntry: joi_1.default.boolean(),
            recordingEnabled: joi_1.default.boolean(),
            chatEnabled: joi_1.default.boolean(),
            password: joi_1.default.string().max(50).allow(''),
        }).optional(),
    }),
};
exports.updateMeeting = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(120),
        description: joi_1.default.string().max(1000).allow(''),
        scheduledAt: joi_1.default.date().iso(),
        maxDuration: joi_1.default.number().integer().min(5).max(480),
        agenda: joi_1.default.array().items(joi_1.default.object({
            title: joi_1.default.string().max(200).required(),
            duration: joi_1.default.number().min(1),
            order: joi_1.default.number(),
        })),
        settings: joi_1.default.object({
            waitingRoom: joi_1.default.boolean(),
            muteOnEntry: joi_1.default.boolean(),
            recordingEnabled: joi_1.default.boolean(),
            chatEnabled: joi_1.default.boolean(),
        }),
    }).min(1),
};
exports.getMeeting = common_schema_1.idParam;
exports.listMeetings = {
    query: common_schema_1.pagination.keys({
        status: joi_1.default.string().valid(...Object.values(constants_1.MEETING_STATUS)).optional(),
        search: joi_1.default.string().max(100).allow('').optional(),
    }),
};
exports.inviteParticipants = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        userIds: joi_1.default.array().items(common_schema_1.mongoId).min(1).max(50).required(),
    }),
};
exports.respondToInvite = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        status: joi_1.default.string().valid('accepted', 'declined').required(),
    }),
};
exports.upsertNote = {
    params: joi_1.default.object({ id: common_schema_1.mongoId.required() }),
    body: joi_1.default.object({
        content: joi_1.default.string().max(50000).allow(''),
        agenda: joi_1.default.array().items(joi_1.default.object({
            title: joi_1.default.string().max(200).required(),
            description: joi_1.default.string().max(500).allow(''),
            duration: joi_1.default.number().min(0),
            isDone: joi_1.default.boolean(),
            order: joi_1.default.number(),
        })),
        actionItems: joi_1.default.array().items(joi_1.default.object({
            text: joi_1.default.string().max(300).required(),
            dueDate: joi_1.default.date().iso().optional(),
        })),
        isPrivate: joi_1.default.boolean(),
        sharedWith: joi_1.default.array().items(common_schema_1.mongoId),
    }),
};
