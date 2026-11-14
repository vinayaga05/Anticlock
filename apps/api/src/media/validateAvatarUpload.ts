import { imageSize } from 'image-size';
import { ApiError } from '../lib/httpError.js';
import { detectMimeFromMagic, sha256 } from './validateUpload.js';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Only URLs minted by the avatar uploader refer to managed profile assets. */
export function managedAvatarReference(value: string | null, apiBase: string) {
  if (value === null) return null;
  const url = new URL(value);
  const base = new URL(apiBase);
  const prefix = `${base.pathname.replace(/\/$/, '')}/v1/media/file/public-media/`;
  if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) return null;
  let key;
  try { key = decodeURIComponent(url.pathname.slice(prefix.length)); }
  catch { throw new ApiError(400, 'invalid_avatar', 'Choose your profile photo again.'); }
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const match = key.match(new RegExp(`^public/avatars/(${uuid})/(${uuid})/original\\.(jpg|png|webp)$`, 'i'));
  if (!match) return null;
  return { key, ownerId: match[1]!, mediaId: match[2]! };
}

/** Avatar uploads are deliberately narrower than document/profile media. */
export function validateAvatarUpload(body: Buffer, declaredMime: string) {
  if (!body.length) throw new ApiError(400, 'empty_upload', 'Choose a photo to upload.');
  if (body.length > MAX_AVATAR_BYTES) throw new ApiError(400, 'file_too_large', 'Choose a photo that is 5 MB or smaller.');
  const mime = declaredMime.trim().toLowerCase().split(';', 1)[0]?.replace(/^image\/jpg$/, 'image/jpeg');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime ?? '')) {
    throw new ApiError(400, 'invalid_mime', 'Choose a JPEG, PNG, or WebP photo.');
  }
  const detected = detectMimeFromMagic(body);
  if (detected !== mime) throw new ApiError(400, 'invalid_image', 'The selected file is not a valid photo of this type.');
  const complete = mime === 'image/jpeg'
    ? body.length >= 4 && body.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
    : mime === 'image/png'
      ? body.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && body.length >= 20 && body.toString('ascii', body.length - 8, body.length - 4) === 'IEND'
      : body.length >= 12 && body.readUInt32LE(4) + 8 === body.length;
  if (!complete) throw new ApiError(400, 'invalid_image', 'The selected photo is incomplete. Choose it again.');
  let dimensions;
  try { dimensions = imageSize(body); }
  catch { throw new ApiError(400, 'invalid_image', 'The selected photo could not be read. Choose another photo.'); }
  const { width, height } = dimensions;
  if (!width || !height || width > 10000 || height > 10000 || width * height > 40_000_000) {
    throw new ApiError(400, 'invalid_image', 'Choose a photo smaller than 40 megapixels.');
  }
  return { mimeType: mime!, byteSize: body.length, checksumSha256: sha256(body), width, height };
}
