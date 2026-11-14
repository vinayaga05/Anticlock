import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Modal, Text, TextInput } from 'react-native';
import { BusinessReviewComposer } from './BusinessReviewComposer';
import { businessBrand } from '../businessProfileModel';
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock('@/shared/components/PressableScale', () => ({
  PressableScale: ({ children, ...props }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable {...props}>{children}</Pressable>;
  },
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('@/test/componentMocks').safeAreaModule,
);
let mockToken: string | null;
const mockPick = jest.fn();
const mockUpload = jest.fn();
jest.mock('@/shared/api/client', () => ({ getApiToken: () => mockToken }));
jest.mock('@/features/profile/utils/profilePhoto', () => ({
  pickProfilePhoto: (...args: any[]) => mockPick(...args),
}));
jest.mock('../businessMedia', () => ({
  uploadBusinessImage: (...args: any[]) => mockUpload(...args),
}));
let props: React.ComponentProps<typeof BusinessReviewComposer>;
const mockClose = jest.fn();
const mockSubmit = jest.fn();
const photo = {
  uri: 'file:///review.jpg',
  filename: 'review.jpg',
  contentType: 'image/jpeg',
  byteSize: 1024,
};
function deferred() {
  let resolve!: (value?: any) => void;
  let reject!: (problem: unknown) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<BusinessReviewComposer {...props} />);
  });
  return renderer;
}
function update(
  renderer: ReactTestRenderer.ReactTestRenderer,
  patch: Partial<typeof props>,
) {
  props = { ...props, ...patch };
  ReactTestRenderer.act(() =>
    renderer.update(<BusinessReviewComposer {...props} />),
  );
}
function action(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findAll(
    node => node.props.accessibilityLabel === label && node.props.onPress,
  )[0];
}
function body(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findByType(TextInput);
}
function fill(
  renderer: ReactTestRenderer.ReactTestRenderer,
  value = '  A thoughtful and welcoming experience.  ',
) {
  ReactTestRenderer.act(() => body(renderer).props.onChangeText(value));
}
function texts(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('\n');
}
async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) {
  await ReactTestRenderer.act(async () => {
    action(renderer, label).props.onPress();
  });
}
function close(renderer: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => renderer.unmount());
}
beforeEach(() => {
  mockToken = 'token-1';
  mockPick.mockReset().mockResolvedValue(photo);
  mockUpload.mockReset().mockResolvedValue('media-1');
  mockClose.mockReset();
  mockSubmit.mockReset().mockResolvedValue({ review: { id: 'review-1' } });
  props = {
    providerId: 'provider-1',
    visible: true,
    brand: businessBrand('provider-1'),
    identity: { type: 'user', id: 'user-1', name: 'Mira', avatarUrl: null },
    bookings: [
      {
        id: 'booking-1',
        serviceTitle: 'Consultation',
        startsAt: '2026-11-10T04:00:00Z',
      },
      {
        id: 'booking-2',
        serviceTitle: 'Training',
        startsAt: '2026-11-11T04:00:00Z',
      },
    ],
    onClose: mockClose,
    onSubmit: mockSubmit,
  };
});
test('defaults to five stars and first completed booking; user can select another rating and booking', async () => {
  const renderer = render();
  expect(
    action(renderer, 'Rate 5 out of 5').props.accessibilityState.selected,
  ).toBe(true);
  expect(
    action(renderer, 'Review Consultation').props.accessibilityState.selected,
  ).toBe(true);
  fill(renderer);
  await press(renderer, 'Rate 3 out of 5');
  await press(renderer, 'Review Training');
  await press(renderer, 'Post verified review');
  expect(mockSubmit).toHaveBeenCalledWith({
    bookingId: 'booking-2',
    rating: 3,
    body: 'A thoughtful and welcoming experience.',
    photoMediaIds: [],
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
  close(renderer);
});
test('requires real eligible completed booking and valid body before request', async () => {
  const renderer = render();
  fill(renderer, 'short');
  await press(renderer, 'Post verified review');
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(texts(renderer)).toContain('10 to 2,000');
  fill(renderer, 'x'.repeat(2001));
  await press(renderer, 'Post verified review');
  expect(mockSubmit).not.toHaveBeenCalled();
  update(renderer, { bookings: [] });
  expect(action(renderer, 'Post verified review').props.disabled).toBe(true);
  await press(renderer, 'Post verified review');
  expect(texts(renderer)).toContain('completed booking');
  close(renderer);
});
test('gallery preview is local; picker cancellation leaves draft unchanged and upload waits for Post', async () => {
  const renderer = render();
  fill(renderer);
  await press(renderer, 'Add review photo');
  expect(mockPick).toHaveBeenCalledWith('library');
  expect(renderer.root.findByType(Image).props.source.uri).toBe(photo.uri);
  expect(mockUpload).not.toHaveBeenCalled();
  mockPick.mockResolvedValue(null);
  await press(renderer, 'Add review photo');
  expect(renderer.root.findAllByType(Image)).toHaveLength(1);
  expect(body(renderer).props.value).toContain('thoughtful');
  expect(mockSubmit).not.toHaveBeenCalled();
  await press(renderer, 'Post verified review');
  expect(mockUpload).toHaveBeenCalledWith(
    props.identity,
    photo,
    expect.any(Object),
  );
  expect(mockSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ photoMediaIds: ['media-1'] }),
  );
  close(renderer);
});
test('picker cannot open twice or race with Post and editing, and Close waits for picker', async () => {
  const picked = deferred();
  mockPick.mockReturnValue(picked.promise);
  const renderer = render();
  fill(renderer);
  const add = action(renderer, 'Add review photo').props.onPress;
  const post = action(renderer, 'Post verified review').props.onPress;
  await ReactTestRenderer.act(async () => {
    add();
    add();
    post();
    action(renderer, 'Close review').props.onPress();
  });
  expect(mockPick).toHaveBeenCalledTimes(1);
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(mockClose).not.toHaveBeenCalled();
  expect(body(renderer).props.editable).toBe(false);
  await ReactTestRenderer.act(async () => picked.resolve(photo));
  expect(body(renderer).props.editable).toBe(true);
  close(renderer);
});
test('Post uploads once, blocks rapid duplicates and waits for server acknowledgement before closing', async () => {
  const uploaded = deferred();
  const saved = deferred();
  mockUpload.mockReturnValue(uploaded.promise);
  mockSubmit.mockReturnValue(saved.promise);
  const renderer = render();
  fill(renderer);
  await press(renderer, 'Add review photo');
  const post = action(renderer, 'Post verified review').props.onPress;
  await ReactTestRenderer.act(async () => {
    post();
    post();
  });
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(body(renderer).props.editable).toBe(false);
  await press(renderer, 'Close review');
  expect(mockClose).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () => uploaded.resolve('media-1'));
  expect(mockSubmit).toHaveBeenCalledTimes(1);
  expect(mockClose).not.toHaveBeenCalled();
  await ReactTestRenderer.act(async () =>
    saved.resolve({ review: { id: 'review-1' } }),
  );
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(body(renderer).props.value).toBe('');
  close(renderer);
});
test('failed review POST preserves photo/body/rating and retry reuses successful upload', async () => {
  mockSubmit
    .mockRejectedValueOnce(new Error('Could not save review'))
    .mockResolvedValueOnce({ review: { id: 'review-1' } });
  const renderer = render();
  fill(renderer);
  await press(renderer, 'Rate 4 out of 5');
  await press(renderer, 'Add review photo');
  await press(renderer, 'Post verified review');
  expect(texts(renderer)).toContain('Could not save review');
  expect(body(renderer).props.value).toContain('thoughtful');
  expect(
    action(renderer, 'Rate 4 out of 5').props.accessibilityState.selected,
  ).toBe(true);
  expect(renderer.root.findByType(Image).props.source.uri).toBe(photo.uri);
  await press(renderer, 'Post verified review');
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockSubmit).toHaveBeenCalledTimes(2);
  expect(mockClose).toHaveBeenCalledTimes(1);
  close(renderer);
});
test.each(['provider', 'identity', 'token', 'hidden', 'unmount'])(
  '%s change during upload prevents stale review POST',
  async change => {
    const uploaded = deferred();
    mockUpload.mockReturnValue(uploaded.promise);
    const renderer = render();
    fill(renderer);
    await press(renderer, 'Add review photo');
    await press(renderer, 'Post verified review');
    const signal = mockUpload.mock.calls[0][2];
    if (change === 'provider') update(renderer, { providerId: 'provider-2' });
    else if (change === 'identity')
      update(renderer, { identity: { ...props.identity!, id: 'user-2' } });
    else if (change === 'token') {
      mockToken = 'token-2';
      update(renderer, {});
    } else if (change === 'hidden') update(renderer, { visible: false });
    else close(renderer);
    expect(signal.aborted).toBe(true);
    await ReactTestRenderer.act(async () => uploaded.resolve('old-media'));
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
    if (change !== 'unmount') close(renderer);
  },
);
test.each(['provider', 'hidden', 'token'])(
  'late picker result or error after %s change does not appear in another draft',
  async change => {
    const picked = deferred();
    mockPick.mockReturnValue(picked.promise);
    const renderer = render();
    await press(renderer, 'Add review photo');
    if (change === 'provider') update(renderer, { providerId: 'provider-2' });
    else if (change === 'hidden') update(renderer, { visible: false });
    else {
      mockToken = 'token-2';
      update(renderer, {});
    }
    await ReactTestRenderer.act(async () => picked.resolve(photo));
    if (change === 'hidden') {
      expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
      update(renderer, { visible: true });
    }
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    close(renderer);
  },
);
test('failed image selection shows an actionable error without discarding review text', async () => {
  mockPick.mockRejectedValue(new Error('Choose a photo no larger than 5 MB.'));
  const renderer = render();
  fill(renderer);
  await press(renderer, 'Add review photo');
  expect(texts(renderer)).toContain('5 MB');
  expect(body(renderer).props.value).toContain('thoughtful');
  expect(mockUpload).not.toHaveBeenCalled();
  close(renderer);
});
test('a booking removed while photo is uploading cannot be silently replaced by another booking', async () => {
  const uploaded = deferred();
  mockUpload.mockReturnValue(uploaded.promise);
  const renderer = render();
  fill(renderer);
  await press(renderer, 'Add review photo');
  await press(renderer, 'Post verified review');
  update(renderer, { bookings: [props.bookings[1]] });
  await ReactTestRenderer.act(async () => uploaded.resolve('media-1'));
  expect(mockSubmit).not.toHaveBeenCalled();
  expect(texts(renderer)).toContain('no longer available');
  close(renderer);
});
test.each(['provider', 'identity', 'token', 'hidden', 'unmount'])(
  '%s change during review POST ignores late acknowledgement and never closes a new draft',
  async change => {
    const saved = deferred();
    mockSubmit.mockReturnValue(saved.promise);
    const renderer = render();
    fill(renderer);
    await press(renderer, 'Post verified review');
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    if (change === 'provider') update(renderer, { providerId: 'provider-2' });
    else if (change === 'identity')
      update(renderer, { identity: { ...props.identity!, id: 'user-2' } });
    else if (change === 'token') {
      mockToken = 'token-2';
      update(renderer, {});
    } else if (change === 'hidden') update(renderer, { visible: false });
    else close(renderer);
    await ReactTestRenderer.act(async () =>
      saved.resolve({ review: { id: 'old-review' } }),
    );
    expect(mockClose).not.toHaveBeenCalled();
    if (change !== 'unmount') close(renderer);
  },
);
test('late picker rejection after provider changes does not show an error in the next draft', async () => {
  const picked = deferred();
  mockPick.mockReturnValue(picked.promise);
  const renderer = render();
  await press(renderer, 'Add review photo');
  update(renderer, { providerId: 'provider-2' });
  await ReactTestRenderer.act(async () =>
    picked.reject(new Error('Old picker failed')),
  );
  expect(texts(renderer)).not.toContain('Old picker failed');
  close(renderer);
});
