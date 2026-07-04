"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("../constants");
const inviteeSchema = new mongoose_1.Schema({
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
}, { _id: false });
const meetingSchema = new mongoose_1.Schema({
    tenantId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Tenant', required: false, default: null, index: true },
    team: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Team', default: null },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    host: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
    invitees: { type: [inviteeSchema], default: [] },
    meetingId: { type: String, required: true, unique: true },
    joinCode: { type: String, required: true, unique: true },
    roomId: { type: String, required: true },
    status: { type: String, enum: Object.values(constants_1.MEETING_STATUS), default: constants_1.MEETING_STATUS.SCHEDULED },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    maxDuration: { type: Number, default: 60 },
    agenda: [
        {
            title: { type: String, maxlength: 200 },
            duration: { type: Number, default: 5 },
            order: { type: Number, default: 0 },
        },
    ],
    isRecurring: { type: Boolean, default: false },
    recurrence: {
        frequency: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly'], default: 'weekly' },
        until: { type: Date, default: null },
    },
    settings: {
        waitingRoom: { type: Boolean, default: false },
        muteOnEntry: { type: Boolean, default: false },
        recordingEnabled: { type: Boolean, default: false },
        chatEnabled: { type: Boolean, default: true },
        password: { type: String, default: '', select: false },
    },
    recordingUrl: { type: String, default: '' },
    transcript: { type: String, default: '' },
    summary: { type: String, default: '' },
    actionItems: [{ text: String, assignee: String, dueDate: Date }],
    sentiment: { type: String, default: '' },
    reminderSent: { type: Boolean, default: false },
}, { timestamps: true });
meetingSchema.index({ tenantId: 1, status: 1 });
meetingSchema.index({ tenantId: 1, scheduledAt: 1 });
meetingSchema.index({ tenantId: 1, host: 1 });
meetingSchema.index({ tenantId: 1, createdAt: -1 });
meetingSchema.index({ tenantId: 1, participants: 1 });
meetingSchema.index({ roomId: 1 }, { unique: true });
meetingSchema.index({ meetingId: 1 }, { unique: true });
meetingSchema.index({ joinCode: 1 }, { unique: true });
const Meeting = mongoose_1.default.model('Meeting', meetingSchema);
exports.default = Meeting;
module.exports = Meeting;
module.exports.default = Meeting;
