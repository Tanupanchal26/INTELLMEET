"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const mongoose = require('mongoose');
const tenantSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    domain: { type: String, default: '' },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    settings: {
        maxMembers: { type: Number, default: 10 },
        aiEnabled: { type: Boolean, default: false },
        recordingEnabled: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
tenantSchema.index({ slug: 1 }, { unique: true });
module.exports = mongoose.model('Tenant', tenantSchema);
