// @ts-nocheck
const cloudinary = require('cloudinary').v2;
const { cloudinary: cloudinaryConfig } = require('./env');

cloudinary.config({
  cloud_name: cloudinaryConfig.name,
  api_key: cloudinaryConfig.key,
  api_secret: cloudinaryConfig.secret,
});

module.exports = cloudinary;

export {};
