import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Image, KeyboardAvoidingView, Linking, StyleSheet, Text, TextInput } from 'react-native';
import { EditProfileScreen } from './EditProfileScreen';
let mockMode = 'light';
jest.mock('@/shared/hooks/useTheme', () => ({ useTheme: () => ({ mode: mockMode }) }));
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => ({ PressableScale: ({ children, ...props }: any) => { const { Pressable } = require('react-native'); return <Pressable {...props}>{children}</Pressable>; } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));
jest.mock('react-native-svg', () => { const { View } = require('react-native'); const Shape = (props: any) => <View {...props} />; return { __esModule: true, default: Shape, Circle: Shape, Defs: Shape, LinearGradient: Shape, Path: Shape, Stop: Shape }; });
const mockGoBack = jest.fn(); const mockDispatch = jest.fn(); let mockPrevention: any;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack, dispatch: mockDispatch }), usePreventRemove: (prevent: boolean, callback: any) => { mockPrevention = { prevent, callback }; } }));
let mockUser: any; let mockToken: string | null;
const mockUpdateProfile = jest.fn(); const mockLogout = jest.fn(); const mockPick = jest.fn(); const mockUpload = jest.fn();
jest.mock('@/shared/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser, updateProfile: mockUpdateProfile, logout: mockLogout }) }));
jest.mock('@/shared/api/client', () => ({ getApiToken: () => mockToken }));
jest.mock('../utils/profilePhoto', () => ({ pickProfilePhoto: (...args: any[]) => mockPick(...args), uploadProfilePhoto: (...args: any[]) => mockUpload(...args) }));
const oldPhoto = 'https://images.example.test/original.jpg'; const uploadedPhoto = 'https://api.example.test/v1/media/file/public-media/avatars/user-1/photo.jpg';
const photo = { uri: 'file:///photo.jpg', filename: 'photo.jpg', contentType: 'image/jpeg', byteSize: 1234 };
const user = (id = 'user-1') => ({ id, displayName: id === 'user-1' ? 'Arun Kumar' : 'Maya Das', phone: '+919000000001', avatarUrl: oldPhoto, bio: 'Runner', location: 'Chennai', website: '' });
function deferred() { let resolve!: (value: any) => void; let reject!: (error: unknown) => void; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function render() { let renderer!: ReactTestRenderer.ReactTestRenderer; ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<EditProfileScreen />); }); return renderer; }
function action(renderer: ReactTestRenderer.ReactTestRenderer, label: string) { return renderer.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0]; }
function field(renderer: ReactTestRenderer.ReactTestRenderer, label: string) { return renderer.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!; }
function texts(renderer: ReactTestRenderer.ReactTestRenderer) { return renderer.root.findAllByType(Text).map(node => [node.props.children].flat().join('')); }
function edit(renderer: ReactTestRenderer.ReactTestRenderer, label: string, value: string) { ReactTestRenderer.act(() => field(renderer, label).props.onChangeText(value)); }
async function press(renderer: ReactTestRenderer.ReactTestRenderer, label: string) { await ReactTestRenderer.act(async () => { action(renderer, label).props.onPress(); }); }
function close(renderer: ReactTestRenderer.ReactTestRenderer) { ReactTestRenderer.act(() => renderer.unmount()); }
beforeEach(() => {
  mockMode = 'light'; mockUser = user(); mockToken = 'test-token-user-1'; mockPrevention = null;
  mockGoBack.mockReset(); mockDispatch.mockReset(); mockUpdateProfile.mockReset().mockResolvedValue(undefined); mockLogout.mockReset(); mockPick.mockReset().mockResolvedValue(photo); mockUpload.mockReset().mockResolvedValue(uploadedPhoto);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {}); jest.spyOn(Linking, 'openSettings').mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());
test('shows Camera/Gallery, grouped fields and locked mobile without a photo-link input', () => {
  const renderer = render(); expect(texts(renderer)).toEqual(expect.arrayContaining(['Camera', 'Gallery', 'About you', 'Details', '+919000000001']));
  expect(renderer.root.findAllByType(TextInput).map(node => node.props.accessibilityLabel)).toEqual(['Name', 'Bio', 'City', 'Website']); expect(action(renderer, 'Save profile changes').props.disabled).toBe(true);
  expect(StyleSheet.flatten(action(renderer, 'Take profile photo').props.style).minHeight).toBeGreaterThanOrEqual(44); expect(renderer.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(0); close(renderer);
});
test('Gallery previews immediately and uploads only on Save', async () => {
  const renderer = render(); await press(renderer, 'Choose profile photo from gallery'); expect(mockPick).toHaveBeenCalledWith('library'); expect(renderer.root.findAllByType(Image)[0].props.source.uri).toBe(photo.uri); expect(mockUpload).not.toHaveBeenCalled(); expect(mockUpdateProfile).not.toHaveBeenCalled();
  await press(renderer, 'Save profile changes'); expect(mockUpload).toHaveBeenCalledWith(photo, expect.objectContaining({ expectedUserId: 'user-1', expectedToken: 'test-token-user-1', signal: expect.any(Object), isCurrentSession: expect.any(Function) })); expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: uploadedPhoto })); expect(texts(renderer)).toContain('Changes saved'); expect(action(renderer, 'Save profile changes').props.disabled).toBe(true); expect(mockGoBack).not.toHaveBeenCalled(); close(renderer);
});
test('Camera invokes native camera and cancellation leaves profile untouched', async () => {
  mockPick.mockResolvedValue(null); const renderer = render(); await press(renderer, 'Take profile photo'); expect(mockPick).toHaveBeenCalledWith('camera'); expect(renderer.root.findAllByType(Image)[0].props.source.uri).toBe(oldPhoto); expect(action(renderer, 'Save profile changes').props.disabled).toBe(true); expect(mockUpload).not.toHaveBeenCalled(); close(renderer);
});
test('photo permission failure provides Settings without losing draft', async () => {
  mockPick.mockRejectedValue(Object.assign(new Error('Allow camera access in Settings.'), { code: 'permission_denied' })); const renderer = render(); edit(renderer, 'Bio', 'New biography'); await press(renderer, 'Take profile photo'); expect(texts(renderer)).toContain('Allow camera access in Settings.'); expect(field(renderer, 'Bio').props.value).toBe('New biography'); await press(renderer, 'Open Settings'); expect(Linking.openSettings).toHaveBeenCalledTimes(1); close(renderer);
});
test('Save waits for both acknowledgements and blocks duplicate presses, editing and Back', async () => {
  const upload = deferred(); const saved = deferred(); mockUpload.mockReturnValue(upload.promise); mockUpdateProfile.mockReturnValue(saved.promise); const renderer = render(); await press(renderer, 'Choose profile photo from gallery'); const save = action(renderer, 'Save profile changes').props.onPress;
  await ReactTestRenderer.act(async () => { save(); save(); }); expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockUpdateProfile).not.toHaveBeenCalled(); expect(field(renderer, 'Name').props.editable).toBe(false); edit(renderer, 'Name', 'Should not apply'); await press(renderer, 'Back'); expect(mockGoBack).not.toHaveBeenCalled(); expect(field(renderer, 'Name').props.value).toBe('Arun Kumar');
  await ReactTestRenderer.act(async () => { upload.resolve(uploadedPhoto); }); expect(mockUpdateProfile).toHaveBeenCalledTimes(1); expect(texts(renderer)).not.toContain('Changes saved'); await ReactTestRenderer.act(async () => { saved.resolve(undefined); }); expect(texts(renderer)).toContain('Changes saved'); close(renderer);
});
test('failed profile-save retry reuses completed photo upload', async () => {
  mockUpdateProfile.mockRejectedValueOnce(new Error('Could not save. Please try again.')).mockResolvedValueOnce(undefined); const renderer = render(); await press(renderer, 'Choose profile photo from gallery'); await press(renderer, 'Save profile changes'); expect(texts(renderer)).toContain('Could not save. Please try again.'); expect(renderer.root.findAllByType(Image)[0].props.source.uri).toBe(photo.uri); await press(renderer, 'Save profile changes'); expect(mockUpload).toHaveBeenCalledTimes(1); expect(mockUpdateProfile).toHaveBeenCalledTimes(2); expect(mockUpdateProfile.mock.calls[1][0].avatarUrl).toBe(uploadedPhoto); expect(texts(renderer)).toContain('Changes saved'); close(renderer);
});
test('explicit removal shows initials and saves null without replacement photo', async () => {
  const renderer = render(); await press(renderer, 'Remove profile photo'); expect(renderer.root.findAllByType(Image)).toHaveLength(0); expect(texts(renderer)).toContain('AK'); await press(renderer, 'Save profile changes'); expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null })); expect(renderer.root.findAllByType(Image)).toHaveLength(0); expect(mockUpload).not.toHaveBeenCalled(); close(renderer);
});
test('normalizes website scheme and rejects invalid names and credential-bearing URLs before save', async () => {
  const renderer = render(); edit(renderer, 'Name', 'A'); await press(renderer, 'Save profile changes'); expect(mockUpdateProfile).not.toHaveBeenCalled(); edit(renderer, 'Name', ' Arun Kumar '); edit(renderer, 'Website', 'https://user:pass@example.com'); await press(renderer, 'Save profile changes'); expect(mockUpdateProfile).not.toHaveBeenCalled(); edit(renderer, 'Website', 'example.com/about'); await press(renderer, 'Save profile changes'); expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Arun Kumar', website: 'https://example.com/about' })); close(renderer);
});
test('dirty changes prompt before leaving and saving blocks navigation', async () => {
  const renderer = render(); edit(renderer, 'City', 'Madurai'); expect(mockPrevention.prevent).toBe(true); const back = { type: 'GO_BACK' }; mockPrevention.callback({ data: { action: back } }); expect(Alert.alert).toHaveBeenCalledWith('Discard changes?', expect.any(String), expect.any(Array)); const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2]; buttons.find((item: any) => item.text === 'Discard').onPress(); expect(mockDispatch).toHaveBeenCalledWith(back);
  const saved = deferred(); mockUpdateProfile.mockReturnValue(saved.promise); await press(renderer, 'Save profile changes'); (Alert.alert as jest.Mock).mockClear(); mockPrevention.callback({ data: { action: back } }); expect(Alert.alert).not.toHaveBeenCalled(); await ReactTestRenderer.act(async () => { saved.resolve(undefined); }); expect(mockPrevention.prevent).toBe(false); close(renderer);
});
test('account change during upload aborts and cannot update new account', async () => {
  const upload = deferred(); mockUpload.mockReturnValue(upload.promise); const renderer = render(); await press(renderer, 'Choose profile photo from gallery'); await press(renderer, 'Save profile changes'); const options = mockUpload.mock.calls[0][1]; mockUser = user('user-2'); mockToken = 'test-token-user-2'; ReactTestRenderer.act(() => renderer.update(<EditProfileScreen />)); expect(options.signal.aborted).toBe(true); expect(options.isCurrentSession()).toBe(false); await ReactTestRenderer.act(async () => { upload.resolve(uploadedPhoto); }); expect(mockUpdateProfile).not.toHaveBeenCalled(); expect(field(renderer, 'Name').props.value).toBe('Maya Das'); close(renderer);
});
test('unmount aborts upload and ignores late result', async () => {
  const upload = deferred(); mockUpload.mockReturnValue(upload.promise); const renderer = render(); await press(renderer, 'Choose profile photo from gallery'); await press(renderer, 'Save profile changes'); const options = mockUpload.mock.calls[0][1]; close(renderer); expect(options.signal.aborted).toBe(true); await ReactTestRenderer.act(async () => { upload.resolve(uploadedPhoto); }); expect(mockUpdateProfile).not.toHaveBeenCalled();
});
test('account change during picker ignores old photo and guests get sign-in gate', async () => {
  const picked = deferred(); mockPick.mockReturnValue(picked.promise); const renderer = render(); await press(renderer, 'Take profile photo'); mockUser = { ...user('user-2'), avatarUrl: null }; mockToken = 'test-token-user-2'; ReactTestRenderer.act(() => renderer.update(<EditProfileScreen />)); await ReactTestRenderer.act(async () => { picked.resolve(photo); }); expect(renderer.root.findAllByType(Image)).toHaveLength(0); mockUser = { id: 'temporary-guest', displayName: 'Guest', phone: '' }; mockToken = null; ReactTestRenderer.act(() => renderer.update(<EditProfileScreen />)); expect(renderer.root.findAllByType(TextInput)).toHaveLength(0); await press(renderer, 'Sign in'); expect(mockLogout).toHaveBeenCalledTimes(1); expect(mockUpload).not.toHaveBeenCalled(); close(renderer);
});
test('dark mode adapts cards while keeping photo controls visible', () => {
  mockMode = 'dark'; const renderer = render(); const card = renderer.root.findAll(node => node.props.testID === 'profile-about-card')[0]; expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe('#1C1C29'); expect(texts(renderer)).toEqual(expect.arrayContaining(['Camera', 'Gallery'])); close(renderer);
});
