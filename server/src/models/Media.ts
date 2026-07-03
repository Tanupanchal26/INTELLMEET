// @ts-nocheck
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  tenantId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  url:          { type: String, required: true },
  publicId:     { type: String, required: true },
  fileName:     { type: String, required: true },
  fileSize:     { type: Number, required: true },
  fileType:     { type: String, required: true },
  resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);

export {};
