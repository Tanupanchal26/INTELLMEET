// @ts-nocheck
const mongoose = require('mongoose');
const { TASK_STATUS, TASK_PRIORITY } = require('../constants');

const historySchema = new mongoose.Schema({
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  field:     { type: String, required: true },
  from:      { type: mongoose.Schema.Types.Mixed },
  to:        { type: mongoose.Schema.Types.Mixed },
  at:        { type: Date, default: Date.now },
}, { _id: false });

const taskSchema = new mongoose.Schema({
  tenantId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  teamId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null, index: true },
  meeting:    { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', default: null, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },
  status:   { type: String, enum: Object.values(TASK_STATUS), default: TASK_STATUS.TODO },
  priority: { type: String, enum: Object.values(TASK_PRIORITY), default: TASK_PRIORITY.MEDIUM },
  dueDate:  { type: Date, default: null },
  tags:     [{ type: String, maxlength: 50 }],
  history:  { type: [historySchema], default: [] },
}, { timestamps: true });

taskSchema.index({ tenantId: 1, status: 1 });
taskSchema.index({ tenantId: 1, teamId: 1 });
taskSchema.index({ tenantId: 1, createdBy: 1 });
taskSchema.index({ tenantId: 1, assignedTo: 1 });
taskSchema.index({ tenantId: 1, dueDate: 1 });
taskSchema.index({ meeting: 1, tenantId: 1 });

module.exports = mongoose.model('Task', taskSchema);

export {};
