// @ts-nocheck
const Recording  = require('../models/Recording');
const Meeting    = require('../models/Meeting');
const ApiError   = require('../utils/ApiError');
const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');
const logger     = require('../shared/utils/logger').default;

exports.uploadRecording = async (meetingId, tenantId, ownerId, buffer, sizeBytes) => {
  const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
  if (!meeting) throw ApiError.notFound('Meeting not found');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'video', folder: `intellmeet/recordings/${tenantId}` },
      async (error, result) => {
        if (error) return reject(ApiError.internal('Cloudinary upload failed'));

        const recording = await Recording.create({
          tenantId,
          meetingId,
          ownerId,
          url:       result.secure_url,
          status:    'ready',
          duration:  Math.round(result.duration || 0),
          sizeBytes: sizeBytes || result.bytes,
        });

        resolve(recording);
      }
    );

    const readable = new Readable();
    readable._read = () => {};
    readable.push(buffer);
    readable.push(null);
    readable.pipe(stream);
  });
};

exports.startRecording = async (meetingId, tenantId, ownerId) => {
  const meeting = await Meeting.findOne({ _id: meetingId, tenantId });
  if (!meeting) throw ApiError.notFound('Meeting not found');

  const recording = await Recording.create({
    tenantId,
    meetingId,
    ownerId,
    url:    '',
    status: 'processing',
  });

  return recording;
};

exports.stopRecording = async (recordingId, tenantId) => {
  const recording = await Recording.findOne({ _id: recordingId, tenantId });
  if (!recording) throw ApiError.notFound('Recording not found');

  recording.status = 'ready';
  await recording.save();

  return recording;
};

exports.getRecordings = async (tenantId, ownerId) =>
  Recording.find({ tenantId, ownerId }).sort({ createdAt: -1 }).populate('meetingId', 'title');

exports.getRecording = async (recordingId, tenantId, ownerId) => {
  const recording = await Recording.findOne({ _id: recordingId, tenantId, ownerId })
    .populate('meetingId', 'title');
  if (!recording) throw ApiError.notFound('Recording not found');
  return recording;
};

exports.deleteRecording = async (recordingId, tenantId, ownerId) => {
  const recording = await Recording.findOne({ _id: recordingId, tenantId, ownerId });
  if (!recording) throw ApiError.notFound('Recording not found');

  if (recording.url && recording.url.includes('cloudinary.com')) {
    try {
      const urlParts = recording.url.split('/');
      const filename = urlParts[urlParts.length - 1];
      const publicId = `intellmeet/recordings/${tenantId}/${filename.split('.')[0]}`;
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    } catch (err) {
      logger.error(`[RECORDING] Failed to delete from Cloudinary: ${err.message}`);
    }
  }

  await recording.deleteOne();
};

export {};
