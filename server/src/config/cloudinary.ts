// @ts-nocheck
const cloudinary = require('cloudinary').v2;
const { cloudinary: cloudinaryConfig } = require('./env');

cloudinary.config({
  cloud_name: cloudinaryConfig.name,
  api_key: cloudinaryConfig.key,
  api_secret: cloudinaryConfig.secret,
});

console.log('[CLOUDINARY DEBUG] cloud_name:', cloudinaryConfig.name);
console.log('[CLOUDINARY DEBUG] api_key:', cloudinaryConfig.key);
console.log('[CLOUDINARY DEBUG] api_secret length:', cloudinaryConfig.secret?.length);
console.log('[CLOUDINARY DEBUG] api_secret first 4 chars:', cloudinaryConfig.secret?.substring(0, 4));

module.exports = cloudinary;

export {};
