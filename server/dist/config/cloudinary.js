"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const cloudinary = require('cloudinary').v2;
const { cloudinary: cloudinaryConfig } = require('./env');
if (!cloudinaryConfig.name || !cloudinaryConfig.key || !cloudinaryConfig.secret) {
    console.error('[CLOUDINARY] FATAL: Missing credentials — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
}
cloudinary.config({
    cloud_name: cloudinaryConfig.name,
    api_key: cloudinaryConfig.key,
    api_secret: cloudinaryConfig.secret,
});
// Validate upload permission on startup (non-blocking).
// Tests resource_type 'image' — the baseline permitted type on all Cloudinary plans.
// 400 "Invalid image file" for an empty buffer = permissions OK.
// 403 = API key missing upload permission.
setImmediate(() => {
    const { PassThrough } = require('stream');
    const pass = new PassThrough();
    const stream = cloudinary.uploader.upload_stream({ resource_type: 'image', folder: 'intellmeet/_healthcheck' }, (err) => {
        if (!err)
            return; // upload succeeded — permissions OK
        if (err.http_code === 403) {
            console.error('[CLOUDINARY] PERMISSION ERROR: API key missing upload permission.\n' +
                '[CLOUDINARY] Fix: Cloudinary Dashboard → Settings → Access Keys → enable Upload on key ' +
                cloudinaryConfig.key + '\n' +
                '[CLOUDINARY] Detail: ' + err.message);
        }
        else if (err.http_code === 401) {
            console.error('[CLOUDINARY] AUTH ERROR: Invalid API key or secret. Check CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.');
        }
        // 400 = permissions fine, file was just invalid (expected for empty buffer)
    });
    pass.pipe(stream);
    pass.end(Buffer.alloc(0));
});
module.exports = cloudinary;
