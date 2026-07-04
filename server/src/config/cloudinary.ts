// @ts-nocheck
const cloudinary = require('cloudinary').v2;
const { cloudinary: cloudinaryConfig } = require('./env');

if (!cloudinaryConfig.name || !cloudinaryConfig.key || !cloudinaryConfig.secret) {
  console.error('[CLOUDINARY] FATAL: Missing credentials — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}

cloudinary.config({
  cloud_name: cloudinaryConfig.name,
  api_key:    cloudinaryConfig.key,
  api_secret: cloudinaryConfig.secret,
});

// Validate upload permission on startup (non-blocking)
// Uses a zero-byte upload attempt to detect restricted API keys early.
setImmediate(() => {
  const { PassThrough } = require('stream');
  const pass = new PassThrough();
  const stream = cloudinary.uploader.upload_stream(
    { resource_type: 'raw', folder: 'intellmeet/_healthcheck', tags: ['healthcheck'] },
    (err) => {
      if (!err) return; // upload succeeded — permissions OK
      if (err.http_code === 403) {
        console.error(
          '[CLOUDINARY] PERMISSION ERROR: Your API key does not have upload (create) permission.\n' +
          '[CLOUDINARY] Fix: Cloudinary Dashboard → Settings → Access Keys → enable Upload permission on key ' +
          cloudinaryConfig.key + '\n' +
          '[CLOUDINARY] Cloudinary error: ' + err.message
        );
      } else if (err.http_code === 401) {
        console.error('[CLOUDINARY] AUTH ERROR: Invalid API key or secret. Verify CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
      }
      // 400 "Invalid file" is expected for empty buffer — means permissions are fine
    }
  );
  pass.pipe(stream);
  pass.end(Buffer.alloc(0));
});

module.exports = cloudinary;

export {};
