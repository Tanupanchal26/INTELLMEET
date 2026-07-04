"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const mongoose = require('mongoose');
const { ROLES } = require('../constants');
// ── Member sub-document ───────────────────────────────────────────────────────
const memberSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'guest'], default: 'member' },
    status: { type: String, enum: ['pending', 'active'], default: 'active' },
    joinedAt: { type: Date, default: Date.now },
}, { _id: false });
// ── Team schema ───────────────────────────────────────────────────────────────
const teamSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, default: '', maxlength: 500 },
    avatar: { type: String, default: '' },
    isPrivate: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    members: { type: [memberSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    settings: {
        allowGuestInvite: { type: Boolean, default: false },
        notifyOnMessage: { type: Boolean, default: true },
    },
}, { timestamps: true });
// Compound unique: one slug per tenant
teamSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
teamSchema.index({ tenantId: 1, isArchived: 1 });
// Virtual: member count
teamSchema.virtual('memberCount').get(function () {
    return this.members.length;
});
module.exports = mongoose.model('Team', teamSchema);
