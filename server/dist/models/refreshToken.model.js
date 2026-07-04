"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const mongoose_1 = __importDefault(require("mongoose"));
const RefreshTokenSchema = new mongoose_1.default.Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
// Index to automatically purge expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
exports.default = mongoose_1.default.model('RefreshToken', RefreshTokenSchema);
