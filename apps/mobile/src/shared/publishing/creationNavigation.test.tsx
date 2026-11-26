import React from 'react';
import Renderer from 'react-test-renderer';
import { TextInput, Alert } from 'react-native';
import { ClipComposerScreen } from '@/features/reels/screens/ClipComposerScreen';
import { FlashComposerScreen } from '@/features/flash/screens/FlashComposerScreen';
import { StoryCreatorScreen } from '@/features/flash/screens/StoryCreatorScreen';
import {
  CREATION_MODES,
  creatorRoute,
  finishCreation,
} from './creationNavigation';
const mockIdentity = {
  id: 'business-1',
  type: 'provider' as const,
  profileType: 'business' as const,
  name: 'My Business',
  avatarUrl: null,
};
let mockParams: any = undefined;
let mockBeforeRemove: ((event: any) => void) | undefined;
const mockNavigation = {
  replace: jest.fn(),
  navigate: jest.fn(),
  popTo: jest.fn(),
  goBack: jest.fn(),
  addListener: (name: string, listener: (event: any) => void) => {
    if (name === 'beforeRemove') mockBeforeRemove = listener;
    return jest.fn();
  },
  isFocused: () => true,
};
const mockPublish = jest.fn();
const mockEnsure = jest.fn();
const mockRestore = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  'react-native-safe-area-context',
  () => require('@/test/componentMocks').safeAreaModule,
);
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/shared/components/Button', () => ({
  Button: (props: any) =>
    require('react').createElement('action-button', props),
}));
jest.mock('@/shared/components/Card', () => ({
  Card: ({ children }: any) => children,
}));
jest.mock('@/shared/components/FilterPills', () => ({
  FilterPills: () => null,
}));
jest.mock('@/shared/publishing/PostingAsCard', () => ({
  PostingAsCard: () => null,
}));
jest.mock('@/features/video/components/VideoPlayer', () => ({
  VideoPlayer: () => null,
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/services/storage', () => ({
  storage: { getString: () => undefined, remove: jest.fn(), set: jest.fn() },
}));
jest.mock('@/shared/publishing/usePublisherSelection', () => ({
  usePublisherSelection: () => ({
    identity: mockIdentity,
    identities: [mockIdentity],
    selectedId: mockIdentity.id,
    restore: mockRestore,
  }),
}));
jest.mock('@/shared/api/publishingHooks', () => ({
  usePublishContentMutation: () => ({
    mutateAsync: mockPublish,
    isPending: false,
  }),
  ensureContentDraft: (...a: any[]) => mockEnsure(...a),
  uploadContentMedia: async () => 'media-1',
  discardContentDraft: jest.fn(),
  UploadCancelledError: class extends Error {},
}));
jest.mock('@/features/reels/media/clipMediaPicker', () => ({
  createVideoUploadFile: async () => ({}),
  createCoverUploadFile: async () => ({}),
  videoFromExport: () => ({ durationMs: 1000, localUri: 'file://clip.mp4' }),
  coverFromExport: () => null,
}));
jest.mock('@/features/reels/camera/ClipCameraScreen', () => ({
  ClipCameraScreen: (props: any) =>
    require('react').createElement('clip-camera', props),
}));
jest.mock('@/features/reels/components/ReelEditor', () => ({
  ReelEditor: (props: any) =>
    require('react').createElement('clip-editor', props),
}));
jest.mock('@/features/flash/media/storyMediaPicker', () => ({
  pickStoryMedia: jest.fn(),
  captureStoryMedia: jest.fn(),
  storyUploadFile: jest.fn(),
  STORY_MAX_SELECTION: 10,
}));
jest.mock('@/shared/publishing/ProfileAvatar', () => ({
  ProfileAvatar: () => null,
}));
jest.mock('@/shared/publishing/ProfileSwitcherSheet', () => ({
  ProfileSwitcherSheet: () => null,
  identityAvatarUrl: () => null,
}));
jest.mock('@/shared/data/flash/storyStore', () => ({
  useStoryStore: (s: any) => s({ publishStory: jest.fn() }),
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  Object.values(mockNavigation).forEach(v => (v as any).mockClear?.());
  mockParams = undefined;
  mockBeforeRemove = undefined;
  mockNavigation.popTo.mockReset();
  mockPublish
    .mockReset()
    .mockResolvedValue({ post: { contentStatus: 'published' } });
  mockEnsure.mockReset().mockResolvedValue('draft-1');
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});
async function render(Component: any) {
  await Renderer.act(async () => {
    tree = Renderer.create(<Component />);
  });
}
async function action(title: string) {
  const button = tree.root.findAll(
    n => n.type === ('action-button' as any) && n.props.title === title,
  )[0];
  expect(button).toBeDefined();
  await Renderer.act(async () => {
    await button.props.onPress();
  });
}
async function prepareClip() {
  await render(ClipComposerScreen);
  await Renderer.act(async () =>
    tree.root.findByType('clip-camera' as any).props.onDone([
      {
        id: 'take',
        uri: 'file://clip.mp4',
        durationMs: 1000,
        origin: 'camera',
      },
    ]),
  );
  await Renderer.act(async () =>
    tree.root.findByType('clip-editor' as any).props.onExported({}),
  );
}
test('only Flash, Clips and Story are offered; identities survive format routing', () => {
  expect(CREATION_MODES.map(x => x.label)).toEqual(['FLASH', 'CLIPS', 'STORY']);
  for (const [mode, screen] of [
    ['post', 'FlashComposer'],
    ['reel', 'ClipComposer'],
    ['story', 'StoryCreator'],
  ] as const) {
    expect(creatorRoute(mode, mockIdentity)).toEqual({
      screen,
      params: {
        publisherProfileId: 'business-1',
        publisherProfileType: 'business',
      },
    });
  }
});
test('Clips camera always starts in Clips mode and switching formats opens the real selected composer', async () => {
  await render(ClipComposerScreen);
  const camera = tree.root.findByType('clip-camera' as any);
  expect(camera.props.mode).toBe('reel');
  await Renderer.act(async () => camera.props.onModeChange('story'));
  expect(mockNavigation.replace).toHaveBeenCalledWith('StoryCreator', {
    publisherProfileId: 'business-1',
    publisherProfileType: 'business',
  });
  await Renderer.act(async () => camera.props.onModeChange('post'));
  expect(mockNavigation.replace).toHaveBeenCalledWith('FlashComposer', {
    publisherProfileId: 'business-1',
    publisherProfileType: 'business',
  });
});
test('Flash submits format flash and returns to Flash only after acknowledgement', async () => {
  await render(FlashComposerScreen);
  await Renderer.act(async () =>
    tree.root.findAllByType(TextInput)[0].props.onChangeText('New Flash'),
  );
  await action('Publish');
  expect(mockPublish).toHaveBeenCalledWith(
    expect.objectContaining({ format: 'flash', identity: mockIdentity }),
  );
  expect(mockNavigation.popTo).toHaveBeenCalledWith('Main', {
    screen: 'Flash',
  });
});
test('Story submits format story and returns to the Flash story tray', async () => {
  await render(StoryCreatorScreen);
  const createText = tree.root.findAll(
    n => n.props.accessibilityLabel === 'Create text story' && n.props.onPress,
  )[0];
  await Renderer.act(async () => createText.props.onPress());
  await Renderer.act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Story text')!
      .props.onChangeText('New story'),
  );
  const share = tree.root.findAll(
    n => n.props.accessibilityLabel === 'Share story' && n.props.onPress,
  )[0];
  await Renderer.act(async () => {
    share.props.onPress();
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
  expect(mockPublish).toHaveBeenCalledWith(
    expect.objectContaining({ format: 'story' }),
  );
  expect(mockNavigation.popTo).toHaveBeenCalledWith('Main', {
    screen: 'Flash',
  });
});
test('Clip submits format clip and redirects to the main Clips feed after publishing', async () => {
  await prepareClip();
  const buttons = tree.root.findAll(n => n.type === ('action-button' as any));
  const publish = buttons.find(
    n =>
      String(n.props.title).includes('Post') ||
      String(n.props.title).includes('Publish'),
  );
  expect(publish).toBeDefined();
  await Renderer.act(async () => {
    await publish!.props.onPress();
  });
  expect(mockPublish).toHaveBeenCalledWith(
    expect.objectContaining({
      format: 'clip',
      mediaType: 'video',
      identity: mockIdentity,
    }),
  );
  expect(mockNavigation.popTo).toHaveBeenCalledWith(
    'Main',
    expect.objectContaining({ screen: 'PlayFeed' }),
  );
});
test.each(['published', 'pending_review'])(
  'successful %s clip releases the upload guard before opening Clips',
  async contentStatus => {
    await prepareClip();
    let complete!: (value: any) => void;
    mockPublish.mockImplementationOnce(() => new Promise(resolve => {
      complete = resolve;
    }));
    const publish = tree.root.findAll(n =>
      n.type === ('action-button' as any) && n.props.title === 'Publish clip',
    )[0];
    let publishing!: Promise<void>;
    await Renderer.act(async () => {
      publishing = publish.props.onPress();
      for (let i = 0; i < 15; i++) await Promise.resolve();
    });
    const leavingDuringUpload = { preventDefault: jest.fn() };
    mockBeforeRemove!(leavingDuringUpload);
    expect(leavingDuringUpload.preventDefault).toHaveBeenCalled();

    const leavingAfterSuccess = { preventDefault: jest.fn() };
    mockNavigation.popTo.mockImplementationOnce(() => {
      mockBeforeRemove!(leavingAfterSuccess);
    });
    await Renderer.act(async () => {
      complete({ post: { contentStatus } });
      await publishing;
    });
    expect(mockNavigation.popTo).toHaveBeenCalledWith('Main',
      expect.objectContaining({ screen: 'PlayFeed' }),
    );
    expect(leavingAfterSuccess.preventDefault).not.toHaveBeenCalled();
  },
);
test('failed Flash publication stays in the composer', async () => {
  mockPublish.mockRejectedValue(new Error('Network failure'));
  await render(FlashComposerScreen);
  await Renderer.act(async () =>
    tree.root.findAllByType(TextInput)[0].props.onChangeText('Keep draft'),
  );
  await action('Publish');
  expect(mockNavigation.popTo).not.toHaveBeenCalled();
});
test('completion resets profile-scoped Clips params and Stories open their tray, not the Clips feed', () => {
  finishCreation(mockNavigation, 'clip');
  expect(mockNavigation.popTo).toHaveBeenLastCalledWith('Main', {
    screen: 'PlayFeed',
    params: {
      profileType: undefined,
      profileId: undefined,
      reelId: undefined,
      q: undefined,
    },
  });
  finishCreation(mockNavigation, 'story');
  expect(mockNavigation.popTo).toHaveBeenLastCalledWith('Main', {
    screen: 'Flash',
  });
});

test('a completed background upload does not redirect a different screen', () => {
  const navigation = { popTo: jest.fn(), isFocused: () => false };
  finishCreation(navigation, 'clip');
  expect(navigation.popTo).not.toHaveBeenCalled();
});

test('opening Clips from Flash preserves the selected publisher and keeps Back available', async () => {
  await render(FlashComposerScreen);
  const entry = tree.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Create a video clip' &&
      typeof n.props.onPress === 'function',
  )[0];
  await Renderer.act(async () => entry.props.onPress());
  expect(mockNavigation.navigate).toHaveBeenCalledWith('ClipComposer', {
    publisherProfileId: 'business-1',
    publisherProfileType: 'business',
  });
});
