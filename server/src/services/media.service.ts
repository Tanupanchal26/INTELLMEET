// @ts-nocheck
const cloudinary = require('../config/cloudinary');
const Media = require('../models/Media');
const ApiError = require('../utils/ApiError');
const logger = require('../shared/utils/logger').default;

// Allowed MIME types
// NOTE: resource_type 'raw' and 'auto' return 403 on this Cloudinary plan.
// Only 'image' and 'video' resource types are permitted.
const ALLOWED_TYPES: Record<string, 'image' | 'video'> = {
  // Images
  'image/jpeg':  'image',
  'image/jpg':   'image',
  'image/png':   'image',
  'image/gif':   'image',
  'image/webp':  'image',
  // Videos
  'video/mp4':       'video',
  'video/mpeg':      'video',
  'video/webm':      'video',
  'video/quicktime': 'video',
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

/**
 * Validates, uploads, and records media file strictly on the server side.
 */
exports.uploadMedia = async (file, tenantId, userId) => {
  if (!file) throw ApiError.badRequest('No file provided');

  if (file.size > MAX_FILE_SIZE) {
    throw ApiError.badRequest('File size exceeds the 10MB limit');
  }

  const resourceType = ALLOWED_TYPES[file.mimetype];
  if (!resourceType) {
    throw ApiError.badRequest(`File type '${file.mimetype}' is not supported`);
  }

  logger.info(`[MEDIA SERVICE] Starting upload for user: ${userId}, size: ${file.size} bytes`);

  return new Promise((resolve, reject) => {
    const folderPath = tenantId ? `intellmeet/media/${tenantId}` : `intellmeet/media/shared`;
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: folderPath,
        resource_type: resourceType,
        filename_override: file.originalname,
        use_filename: true,
      },
      async (error, result) => {
        if (error) {
          logger.error(`[MEDIA SERVICE] Cloudinary upload failed: ${error.message}`);
          return reject(new ApiError(500, `Cloudinary upload failed: ${error.message}`));
        }

        try {
          const mediaDoc: any = {
            uploadedBy: userId,
            url: result.secure_url,
            publicId: result.public_id,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            resourceType,
          };
          if (tenantId) mediaDoc.tenantId = tenantId;

          const media = await Media.create(mediaDoc);
          logger.info(`[MEDIA SERVICE] Successfully uploaded and recorded: ${media._id}`);
          resolve(media);
        } catch (dbErr) {
          logger.error(`[MEDIA SERVICE] Database save failed: ${dbErr.message}`);
          try {
            await cloudinary.uploader.destroy(result.public_id, { resource_type: resourceType });
          } catch (delErr) {
            logger.error(`[MEDIA SERVICE] Rollback cleanup failed: ${delErr.message}`);
          }
          reject(new ApiError(500, `Database recording failed: ${dbErr.message}`));
        }
      }
    );
    uploadStream.end(file.buffer);
  });
};

/**
 * Retrieves list of all uploaded media files for a tenant.
 */
exports.getMediaList = async (tenantId) => {
  return Media.find({ tenantId }).sort({ createdAt: -1 }).populate('uploadedBy', 'name');
};

/**
 * Deletes media file reference from database and destroys from Cloudinary.
 */
exports.deleteMedia = async (mediaId, tenantId, userId) => {
  const media = await Media.findOne({ _id: mediaId, tenantId });
  if (!media) throw ApiError.notFound('Media reference not found');

  logger.info(`[MEDIA SERVICE] Deleting media ${mediaId} requested by user ${userId}`);

  // Delete from Cloudinary
  try {
    const res = await cloudinary.uploader.destroy(media.publicId, { resource_type: media.resourceType });
    if (res.result !== 'ok' && res.result !== 'not found') {
      throw new Error(`Cloudinary delete result: ${res.result}`);
    }
  } catch (err) {
    logger.error(`[MEDIA SERVICE] Cloudinary cleanup failed: ${err.message}`);
    // Proceed to delete database document even if Cloudinary file is already missing
  }

  await media.deleteOne();
  logger.info(`[MEDIA SERVICE] Successfully deleted media reference: ${mediaId}`);
};

export {};
