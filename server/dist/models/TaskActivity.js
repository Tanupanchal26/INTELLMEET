"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const mongoose = require('mongoose');
const taskActivitySchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, maxlength: 100 }, // e.g. 'created', 'status_changed', 'assigned'
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
taskActivitySchema.index({ taskId: 1, createdAt: -1 });
taskActivitySchema.index({ teamId: 1, createdAt: -1 });
module.exports = mongoose.model('TaskActivity', taskActivitySchema);
