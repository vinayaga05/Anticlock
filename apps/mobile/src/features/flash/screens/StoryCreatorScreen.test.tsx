import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert, BackHandler, Text, TextInput } from 'react-native';
import { StoryCreatorScreen } from './StoryCreatorScreen';
import { DEFAULT_STORY_STYLE } from '../utils/storyComposerModel';

const mockIdentity = {
  id: 'business-1',
  type: 'provider',
  profileType: 'business',
  name: 'My Business',
  avatarUrl: null,
};
const mockNavigation = {
  popTo: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  canGoBack: jest.fn(),
  reset: jest.fn(),
  isFocused: () => true,
};
const mockPublish = jest.fn();
const mockEnsure = jest.fn();
const mockUpload = jest.fn();
const mockPick = jest.fn();
const mockUploadFile = jest.fn();
const mockLocal = jest.fn();
let mockParams: any;
let hardwareBack: (() => boolean | null | undefined) | undefined;
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
jest.mock('@/features/video/components/VideoPlayer', () => ({
  VideoPlayer: () => null,
}));
jest.mock('@/shared/publishing/ProfileAvatar', () => ({
  ProfileAvatar: () => null,
}));
jest.mock('@/shared/publishing/ProfileSwitcherSheet', () => ({
  ProfileSwitcherSheet: () => null,
  identityAvatarUrl: () => null,
}));
jest.mock('@/shared/publishing/usePublisherSelection', () => ({
  usePublisherSelection: () => ({
    identity: mockIdentity,
    identities: [mockIdentity],
    select: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/data/flash/storyStore', () => ({
  useStoryStore: (select: any) => select({ publishStory: mockLocal }),
}));
jest.mock('@/shared/api/publishingHooks', () => ({
  usePublishContentMutation: () => ({
    mutateAsync: mockPublish,
    isPending: false,
  }),
  ensureContentDraft: (...args: any[]) => mockEnsure(...args),
  uploadContentMedia: (...args: any[]) => mockUpload(...args),
}));
jest.mock('../media/storyMediaPicker', () => ({
  pickStoryMedia: (...args: any[]) => mockPick(...args),
  storyUploadFile: (...args: any[]) => mockUploadFile(...args),
  captureStoryMedia: jest.fn(),
  STORY_MAX_SELECTION: 10,
}));
const photo = (id: string) => ({
  id,
  type: 'photo',
  uri: `file:///${id}.jpg`,
  filename: `${id}.jpg`,
  contentType: 'image/jpeg',
  byteSize: 20,
  loadBytes: jest.fn(),
});
let tree: Renderer.ReactTestRenderer;
const node = (label: string) =>
  tree.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}
async function press(label: string) {
  const target = node(label);
  expect(target).toBeDefined();
  await Renderer.act(async () => {
    target.props.onPress();
    await flush();
  });
}
async function fill(label: string, value: string) {
  await Renderer.act(async () =>
    tree.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === label)!
      .props.onChangeText(value),
  );
}
async function render() {
  await Renderer.act(async () => {
    tree = Renderer.create(<StoryCreatorScreen />);
  });
}
function text() {
  return tree.root
    .findAllByType(Text)
    .map(n => n.props.children)
    .join(' ');
}
beforeEach(() => {
  mockParams = undefined;
  hardwareBack = undefined;
  mockNavigation.canGoBack.mockReset().mockReturnValue(true);
  jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((event, listener) => {
      if (event === 'hardwareBackPress') hardwareBack = listener;
      return { remove: jest.fn() };
    });
  Object.values(mockNavigation).forEach(value => (value as any).mockClear?.());
  mockPublish
    .mockReset()
    .mockResolvedValue({ post: { contentStatus: 'published' } });
  mockEnsure
    .mockReset()
    .mockImplementation(
      async (input: any) => `draft-${input.caption || 'photo'}`,
    );
  mockUpload.mockReset().mockResolvedValue('media-1');
  mockPick.mockReset().mockResolvedValue([photo('one')]);
  mockUploadFile.mockReset().mockResolvedValue({
    kind: 'image',
    byteSize: 20,
    localUri: 'file:///one.jpg',
    filename: 'one.jpg',
    contentType: 'image/jpeg',
  });
  mockLocal.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  Renderer.act(() => tree?.unmount());
  jest.restoreAllMocks();
});

test('an empty text story cannot publish and selection cannot advance without media', async () => {
  await render();
  expect(node('Next: edit story').props.disabled).toBe(true);
  await press('Create text story');
  expect(node('Share story').props.disabled).toBe(true);
  await press('Share story');
  expect(mockPublish).not.toHaveBeenCalled();
  await fill('Story text', '  ');
  expect(node('Share story').props.disabled).toBe(true);
});

test('gallery selection proceeds through editor and server upload before returning to the story tray', async () => {
  await render();
  await press('Browse device gallery');
  expect(mockPick).toHaveBeenCalledWith('all', 10);
  expect(text()).toContain('1 selected');
  expect(mockPublish).not.toHaveBeenCalled();
  await press('Next: edit story');
  await press('Share story');
  expect(mockEnsure).toHaveBeenCalledWith(
    expect.objectContaining({
      format: 'story',
      mediaType: 'image',
      identity: mockIdentity,
    }),
  );
  expect(mockUpload).toHaveBeenCalledWith(
    mockIdentity,
    expect.objectContaining({ kind: 'image' }),
    'public',
    expect.any(String),
  );
  expect(mockPublish).toHaveBeenCalledWith(
    expect.objectContaining({
      format: 'story',
      draftId: expect.any(String),
      mediaIds: ['media-1'],
    }),
  );
  expect(mockLocal).not.toHaveBeenCalled();
  expect(mockNavigation.popTo).toHaveBeenCalledWith('Main', {
    screen: 'Flash',
  });
});

test('text, background, size, sticker and location are submitted with the story', async () => {
  await render();
  await press('Create text story');
  await fill('Story text', '  Little moments  ');
  await press('Add location label');
  await fill('Story location', '  Pondicherry  ');
  await press('Change story style');
  await press('Use color #063eea');
  await press('Larger story text');
  await press('Add sticker');
  await press('Use sticker ✨');
  await press('Share story');
  expect(mockPublish).toHaveBeenCalledWith(
    expect.objectContaining({
      format: 'story',
      mediaType: 'text',
      caption: 'Little moments',
      location: { name: 'Pondicherry' },
      storyStyle: {
        ...DEFAULT_STORY_STYLE,
        backgroundColor: '#063eea',
        textScale: 1.1,
        sticker: '✨',
      },
    }),
  );
  expect(mockEnsure).toHaveBeenCalledTimes(1);
  expect(mockEnsure).toHaveBeenCalledWith(
    expect.objectContaining({ mediaType: 'text', caption: 'Little moments' }),
  );
  expect(mockUpload).not.toHaveBeenCalled();
});

test('an edited photo caption is preserved with the uploaded media', async () => {
  await render();
  await press('Browse device gallery');
  await press('Next: edit story');
  await press('Edit story text');
  await fill('Story text', 'Photo caption');
  await press('Share story');
  expect(mockPublish).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaType: 'image',
      caption: 'Photo caption',
      mediaIds: ['media-1'],
      storyStyle: DEFAULT_STORY_STYLE,
    }),
  );
});

test('rapid duplicate presses create only one publication', async () => {
  let resolve!: (value: any) => void;
  mockPublish.mockReturnValue(
    new Promise(yes => {
      resolve = yes;
    }),
  );
  await render();
  await press('Create text story');
  await fill('Story text', 'One moment');
  const share = node('Share story').props.onPress;
  await Renderer.act(async () => {
    share();
    share();
    await flush();
  });
  expect(mockPublish).toHaveBeenCalledTimes(1);
  expect(mockNavigation.popTo).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    resolve({ post: { contentStatus: 'published' } });
    await flush();
  });
  expect(mockNavigation.popTo).toHaveBeenCalledTimes(1);
});

test('partial multi-item failure retains only unposted moments and retry reuses the uploaded failed draft', async () => {
  mockPick.mockResolvedValue([photo('one'), photo('two'), photo('three')]);
  mockEnsure
    .mockReset()
    .mockResolvedValueOnce('draft-one')
    .mockResolvedValueOnce('draft-two')
    .mockResolvedValueOnce('draft-three');
  mockUpload
    .mockReset()
    .mockResolvedValueOnce('media-one')
    .mockResolvedValueOnce('media-two')
    .mockResolvedValueOnce('media-three');
  mockPublish
    .mockReset()
    .mockResolvedValueOnce({ post: { contentStatus: 'published' } })
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue({ post: { contentStatus: 'published' } });
  await render();
  await press('Browse device gallery');
  await press('Next: edit story');
  await press('Share story');
  expect(mockPublish).toHaveBeenCalledTimes(2);
  expect(mockNavigation.popTo).not.toHaveBeenCalled();
  expect(text()).toContain('1 moment shared. Offline');
  await press('Share story');
  expect(mockPublish).toHaveBeenCalledTimes(4);
  expect(mockPublish.mock.calls.map(call => call[0].mediaIds)).toEqual([
    ['media-one'],
    ['media-two'],
    ['media-two'],
    ['media-three'],
  ]);
  expect(mockEnsure).toHaveBeenCalledTimes(3);
  expect(mockUpload).toHaveBeenCalledTimes(3);
  expect(mockNavigation.popTo).toHaveBeenCalledTimes(1);
});

test('a failed text publication retries the same draft without creating a second story container', async () => {
  mockEnsure.mockReset().mockResolvedValue('text-draft-1');
  mockPublish
    .mockReset()
    .mockRejectedValueOnce(new Error('Request timed out'))
    .mockResolvedValue({ post: { contentStatus: 'published' } });
  await render();
  await press('Create text story');
  await fill('Story text', 'Keep this moment');
  await press('Share story');
  expect(mockNavigation.popTo).not.toHaveBeenCalled();
  expect(text()).toContain('Request timed out');
  await press('Share story');
  expect(mockEnsure).toHaveBeenCalledTimes(1);
  expect(mockPublish).toHaveBeenCalledTimes(2);
  expect(mockPublish.mock.calls.map(call => call[0].draftId)).toEqual([
    'text-draft-1',
    'text-draft-1',
  ]);
  expect(mockUpload).not.toHaveBeenCalled();
  expect(mockNavigation.popTo).toHaveBeenCalledTimes(1);
});

test('changing audience after a failed media publication creates a fresh draft and reuploads with the new visibility', async () => {
  mockEnsure
    .mockReset()
    .mockResolvedValueOnce('draft-public')
    .mockResolvedValueOnce('draft-followers');
  mockUpload
    .mockReset()
    .mockResolvedValueOnce('media-public')
    .mockResolvedValueOnce('media-followers');
  mockPublish
    .mockReset()
    .mockRejectedValueOnce(new Error('Network failure'))
    .mockResolvedValue({ post: { contentStatus: 'published' } });
  await render();
  await press('Browse device gallery');
  await press('Next: edit story');
  await press('Share story');
  expect(mockNavigation.popTo).not.toHaveBeenCalled();
  await press('Story audience');
  const label = tree.root
    .findAllByType(Text)
    .find(item => item.props.children === 'Followers')!;
  let choice = label;
  while (!choice.props.onPress && choice.parent) choice = choice.parent;
  await Renderer.act(async () => choice.props.onPress());
  await press('Share story');
  expect(mockEnsure.mock.calls.map(call => call[0].visibility)).toEqual([
    'public',
    'followers',
  ]);
  expect(mockUpload.mock.calls.map(call => [call[2], call[3]])).toEqual([
    ['public', 'draft-public'],
    ['followers', 'draft-followers'],
  ]);
  expect(
    mockPublish.mock.calls.map(call => [
      call[0].visibility,
      call[0].draftId,
      call[0].mediaIds,
    ]),
  ).toEqual([
    ['public', 'draft-public', ['media-public']],
    ['followers', 'draft-followers', ['media-followers']],
  ]);
  expect(mockNavigation.popTo).toHaveBeenCalledTimes(1);
});

const trayReset = {
  index: 0,
  routes: [{ name: 'Main', params: { screen: 'Flash' } }],
};

test('closing an empty creator returns to its previous route when one exists', async () => {
  await render();
  await press('Close story creator');
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  expect(mockNavigation.reset).not.toHaveBeenCalled();
});

test('closing a creator opened without a previous route resets to the story tray', async () => {
  mockNavigation.canGoBack.mockReturnValue(false);
  await render();
  await press('Close story creator');
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.reset).toHaveBeenCalledWith(trayReset);
});

test.each([true, false])(
  'confirmed discard uses a safe destination when canGoBack is %s',
  async canGoBack => {
    mockNavigation.canGoBack.mockReturnValue(canGoBack);
    await render();
    await press('Create text story');
    await fill('Story text', 'Unsaved words');
    await press('Back to story selection');
    await press('Close story creator');
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    const alert = (Alert.alert as jest.Mock).mock.calls.find(
      call => call[0] === 'Discard story?',
    );
    const buttons = alert[2];
    const discard = buttons.find((button: any) => button.text === 'Discard');
    await Renderer.act(async () => discard.onPress());
    if (canGoBack) {
      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.reset).not.toHaveBeenCalled();
    } else {
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
      expect(mockNavigation.reset).toHaveBeenCalledWith(trayReset);
    }
  },
);

test('Android Back closes editor controls before prompting and safely exits a deep-linked creator', async () => {
  mockNavigation.canGoBack.mockReturnValue(false);
  await render();
  await press('Create text story');
  await fill('Story text', 'Unsaved moment');
  expect(hardwareBack).toBeDefined();
  await Renderer.act(async () => {
    expect(hardwareBack!()).toBe(true);
  });
  expect(text()).toContain('Edit story');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await Renderer.act(async () => {
    expect(hardwareBack!()).toBe(true);
  });
  expect(text()).toContain('Create story');
  expect(Alert.alert).not.toHaveBeenCalled();
  await Renderer.act(async () => {
    expect(hardwareBack!()).toBe(true);
  });
  const alert = (Alert.alert as jest.Mock).mock.calls.find(
    call => call[0] === 'Discard story?',
  );
  await Renderer.act(async () =>
    alert[2].find((button: any) => button.text === 'Discard').onPress(),
  );
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.reset).toHaveBeenCalledWith(trayReset);
});

test('Android Back on an empty deep-linked creator returns to the tray without a GO_BACK action', async () => {
  mockNavigation.canGoBack.mockReturnValue(false);
  await render();
  await Renderer.act(async () => {
    expect(hardwareBack!()).toBe(true);
  });
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
  expect(mockNavigation.reset).toHaveBeenCalledWith(trayReset);
});
