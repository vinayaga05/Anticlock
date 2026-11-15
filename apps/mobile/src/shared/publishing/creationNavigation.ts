import type {
  PublishFormat,
  PublisherIdentityLike,
} from './publisherSelection';
import { identityProfileType } from './publisherSelection';
export type CreationMode = 'post' | 'reel' | 'story';
export const CREATION_MODES: { id: CreationMode; label: string }[] = [
  { id: 'post', label: 'FLASH' },
  { id: 'reel', label: 'CLIPS' },
  { id: 'story', label: 'STORY' },
];
export function creatorRoute(
  mode: CreationMode,
  identity?: PublisherIdentityLike | null,
) {
  const screen =
    mode === 'post'
      ? 'FlashComposer'
      : mode === 'story'
      ? 'StoryCreator'
      : 'ClipComposer';
  return {
    screen,
    params: identity
      ? {
          publisherProfileId: identity.id,
          publisherProfileType: identityProfileType(identity),
        }
      : undefined,
  };
}
/** Pop the creator stack only after the server has acknowledged publication.
 * Stories live in the Flash story tray. Pending review keeps its truthful notice.
 * Reset any profile-scoped Clips route so the main feed opens after publishing.
 */
export function finishCreation(
  navigation: {
    popTo: (screen: 'Main', params: any) => void;
    isFocused?: () => boolean;
  },
  format: PublishFormat,
) {
  if (navigation.isFocused?.() === false) return;
  navigation.popTo(
    'Main',
    format === 'clip'
      ? {
          screen: 'PlayFeed',
          params: {
            profileType: undefined,
            profileId: undefined,
            reelId: undefined,
            q: undefined,
          },
        }
      : { screen: 'Flash' },
  );
}
