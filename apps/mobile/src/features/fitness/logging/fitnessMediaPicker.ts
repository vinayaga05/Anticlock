import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
export type FitnessMediaSource = 'camera' | 'video' | 'library';
export type PickedFitnessMedia = {
  uri: string;
  name: string;
  type: string;
  byteSize?: number;
};
export function fitnessMediaAsset(
  asset: Asset | undefined,
): PickedFitnessMedia {
  if (!asset?.uri || !/^(file|content):\/\//i.test(asset.uri))
    throw new Error('Choose a readable photo or video.');
  const type = asset.type === 'image/jpg' ? 'image/jpeg' : asset.type;
  if (
    !type ||
    !['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(type)
  )
    throw new Error('Choose a JPEG, PNG, WebP photo or MP4 video.');
  const max = type === 'video/mp4' ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
  if (
    asset.fileSize !== undefined &&
    (!Number.isFinite(asset.fileSize) ||
      asset.fileSize <= 0 ||
      asset.fileSize > max)
  )
    throw new Error(
      type === 'video/mp4'
        ? 'Choose a video up to 25 MB.'
        : 'Choose a photo up to 5 MB.',
    );
  return {
    uri: asset.uri,
    name:
      asset.fileName ??
      (type === 'video/mp4' ? 'fitness-video.mp4' : 'fitness-photo.jpg'),
    type,
    byteSize: asset.fileSize,
  };
}
async function cameraPermission(video: boolean) {
  if (Platform.OS !== 'android') return;
  for (const permission of [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    ...(video ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] : []),
  ]) {
    if (await PermissionsAndroid.check(permission)) continue;
    const result = await PermissionsAndroid.request(permission, {
      title: video ? 'Camera and microphone' : 'Camera access',
      message: video
        ? 'Record a private fitness video.'
        : 'Take a private fitness photo.',
      buttonPositive: 'Continue',
      buttonNegative: 'Not now',
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED)
      throw new Error(
        'Allow camera access in device Settings, or choose from your gallery.',
      );
  }
}
export async function pickFitnessMedia(
  source: FitnessMediaSource,
  allowVideo = false,
): Promise<PickedFitnessMedia | null> {
  if (source === 'video' && !allowVideo)
    throw new Error('Choose a photo for this entry.');
  if (source !== 'library') await cameraPermission(source === 'video');
  const result =
    source === 'library'
      ? await launchImageLibrary({
          mediaType: allowVideo ? 'mixed' : 'photo',
          selectionLimit: 1,
          includeBase64: false,
          includeExtra: false,
          assetRepresentationMode: 'compatible',
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 0.8,
        })
      : await launchCamera(
          source === 'video'
            ? {
                mediaType: 'video',
                videoQuality: 'low',
                durationLimit: 60,
                formatAsMp4: true,
                saveToPhotos: false,
                includeBase64: false,
              }
            : {
                mediaType: 'photo',
                cameraType: 'back',
                maxWidth: 1600,
                maxHeight: 1600,
                quality: 0.8,
                saveToPhotos: false,
                includeBase64: false,
                includeExtra: false,
                assetRepresentationMode: 'compatible',
              },
        );
  if (result.didCancel) return null;
  if (result.errorCode)
    throw new Error(
      result.errorCode === 'permission'
        ? 'Allow access in device Settings, or choose another source.'
        : result.errorCode === 'camera_unavailable'
        ? 'Camera unavailable. Choose a photo from your gallery.'
        : 'The picker could not open. Try again.',
    );
  const picked = fitnessMediaAsset(result.assets?.[0]);
  if (!allowVideo && picked.type === 'video/mp4')
    throw new Error('Choose a photo for this entry.');
  return picked;
}
