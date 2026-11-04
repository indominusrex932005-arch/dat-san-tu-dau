import { v2 as cloudinary } from 'cloudinary';

export function imageStorageReady(env = process.env) {
  return /^[a-zA-Z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME || '')
    && Boolean(env.CLOUDINARY_API_KEY?.trim() && env.CLOUDINARY_API_SECRET?.trim());
}

function options() {
  return {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, timeout: 20000,
    api_proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  };
}

export const cloudImageStorage = {
  ready: imageStorageReady,
  upload(buffer, publicId) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        ...options(), public_id: publicId, resource_type: 'image',
        format: 'webp', overwrite: false
      }, (error, result) => {
        if (error) return reject(error);
        const expected = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
        if (!result?.secure_url?.startsWith(expected) || result.public_id !== publicId) {
          return reject(new Error('Unexpected image storage response'));
        }
        resolve(result.secure_url);
      });
      stream.on('error', reject);
      stream.end(buffer);
    });
  },
  async destroy(publicId) {
    const result = await cloudinary.uploader.destroy(publicId, { ...options(), resource_type: 'image', invalidate: true });
    if (!['ok', 'not found'].includes(result.result)) throw new Error('Image cleanup failed');
  }
};
