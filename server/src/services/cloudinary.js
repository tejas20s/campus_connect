import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

const isConfigured = Boolean(
  env.cloudinaryCloudName &&
  env.cloudinaryApiKey &&
  env.cloudinaryApiSecret
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true
  });
}

export function isCloudinaryConfigured() {
  return isConfigured;
}

export function uploadPrivateFile(buffer, { folder, publicId, resourceType, format }) {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream({
      folder,
      public_id: publicId,
      resource_type: resourceType,
      type: 'authenticated',
      access_mode: 'authenticated',
      format,
      overwrite: true,
      unique_filename: false,
      use_filename: false
    }, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result) {
        reject(new Error('Cloudinary did not return an upload result.'));
        return;
      }
      resolve(result);
    });

    upload.end(buffer);
  });
}

export function createPrivateDownloadUrl(publicId, format, { resourceType = 'raw', attachment = true } = {}) {
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const options = {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: expiresAt
  };
  if (attachment) options.attachment = true;
  return cloudinary.utils.private_download_url(publicId, format, options);
}
