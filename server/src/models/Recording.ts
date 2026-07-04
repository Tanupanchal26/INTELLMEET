// @ts-nocheck
const mongoose = require('mongoose');

const recordingSchema = new mongoose.Schema({
  tenantId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  url:       { type: String, required: false, default: '' },
  sizeBytes: { type: Number, default: 0 },
  duration:  { type: Number, default: 0 }, // in seconds
  
  status:    { type: String, enum: ['processing', 'ready', 'failed'], default: 'processing' },
}, { timestamps: true });

module.exports = mongoose.model('Recording', recordingSchema);

export {};
