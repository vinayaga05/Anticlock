import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text, TextInput } from 'react-native';
import { BusinessBookingScreen } from './BusinessBookingScreen';
import { BusinessManageScreen } from './BusinessManageScreen';
import { businessFixture } from '../businessTestFixture';
import { ApiError } from '@/shared/api/client';

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
jest.mock('@/shared/components/Button', () => ({
  Button: (props: any) => {
    const { Pressable } = require('react-native');
    return <Pressable {...props} />;
  },
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('@/test/componentMocks').safeAreaModule,
);
jest.mock('@/features/provider-onboarding/components/DateTimeFields', () => ({
  DateField: () => null,
}));
jest.mock('@/features/provider-onboarding/components/MapLocationField', () => ({
  MapLocationField: () => null,
}));
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
let mockParams: any;
let mockPrevention: any;
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockParams }),
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    dispatch: mockDispatch,
    goBack: jest.fn(),
  }),
  usePreventRemove: (prevent: boolean, callback: any) => {
    mockPrevention = { prevent, callback };
  },
}));
let mockUser: any;
let mockToken: string | null;
const mockLogout = jest.fn();
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));
jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client');
  return { ApiError: actual.ApiError, getApiToken: () => mockToken };
});
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({
    identities: [{ id: 'provider-1', type: 'provider', role: 'owner' }],
  }),
}));
const mockPick = jest.fn();
const mockUpload = jest.fn();
jest.mock('@/features/profile/utils/profilePhoto', () => ({
  pickProfilePhoto: (...args: any[]) => mockPick(...args),
}));
jest.mock('../businessMedia', () => ({
  uploadBusinessImage: (...args: any[]) => mockUpload(...args),
}));
let mockBusiness: any;
let mockAvailability: any;
let mockAnalytics: any;
let mockCatalog: any;
const mockCreate = jest.fn();
const mockSaveProfile = jest.fn();
const mockSaveServices = jest.fn();
const mockRefetch = jest.fn();
jest.mock('../businessProfileHooks', () => ({
  useBusinessProfileQuery: () => ({
    data: mockBusiness,
    refetch: mockRefetch,
    isLoading: false,
  }),
  useBusinessAvailabilityQuery: () => ({
    data: mockAvailability,
    refetch: mockRefetch,
    isLoading: false,
    isFetching: false,
  }),
  useBusinessAnalyticsQuery: () => ({
    data: mockAnalytics,
    isLoading: false,
    refetch: mockRefetch,
  }),
  useBusinessServiceCatalogQuery: () => ({
    data: mockCatalog,
    isLoading: false,
    refetch: mockRefetch,
  }),
  useCreateBusinessBookingMutation: () => ({ mutateAsync: mockCreate }),
  useUpdateBusinessProfileMutation: () => ({ mutateAsync: mockSaveProfile }),
  useUpdateBusinessServicesMutation: () => ({ mutateAsync: mockSaveServices }),
}));
const slot = {
  startsAt: '2026-11-18T04:00:00.000Z',
  endsAt: '2026-11-18T05:00:00.000Z',
  available: true,
};
const photo = {
  uri: 'file:///logo.jpg',
  filename: 'logo.jpg',
  contentType: 'image/jpeg',
  byteSize: 50,
};
function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function render(kind: 'booking' | 'manage' = 'booking') {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      kind === 'booking' ? <BusinessBookingScreen /> : <BusinessManageScreen />,
    );
  });
  return renderer;
}
function button(renderer: ReactTestRenderer.ReactTestRenderer, title: string) {
  return renderer.root.findAll(
    node => node.props.title === title && node.props.onPress,
  )[0];
}
function text(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''))
    .join('\n');
}
function field(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
}
function edit(
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
  value: string,
) {
  ReactTestRenderer.act(() => field(renderer, label).props.onChangeText(value));
}
async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  title: string,
) {
  await ReactTestRenderer.act(async () => {
    button(renderer, title).props.onPress();
  });
}
function chooseTime(renderer: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() =>
    renderer.root
      .findAll(
        node =>
          node.props.accessibilityLabel?.startsWith('Time ') &&
          node.props.onPress,
      )[0]
      .props.onPress(),
  );
}
function close(renderer: ReactTestRenderer.ReactTestRenderer) {
  ReactTestRenderer.act(() => renderer.unmount());
}
beforeEach(() => {
  mockUser = { id: 'user-1' };
  mockToken = 'token-1';
  mockParams = { providerId: 'provider-1' };
  mockBusiness = businessFixture();
  mockAvailability = {
    date: '2026-11-18',
    categoryId: 'service-1',
    serviceMode: 'center',
    durationMinutes: 60,
    timeZone: 'Asia/Kolkata',
    slots: [slot],
    reason: null,
  };
  mockAnalytics = {
    totalBookings: 12,
    upcomingBookings: 3,
    completedBookings: 9,
    paidRevenue: 6750,
    totalReviews: 3,
    averageRating: 4.7,
    profileViews: null,
  };
  mockCatalog = [{ id: 'service-2', name: 'Training' }];
  mockNavigate.mockReset();
  mockReplace.mockReset();
  mockDispatch.mockReset();
  mockLogout.mockReset();
  mockRefetch.mockReset();
  mockCreate
    .mockReset()
    .mockResolvedValue({ id: 'booking-1', providerId: 'provider-1' });
  mockSaveProfile.mockReset().mockResolvedValue({ business: mockBusiness });
  mockSaveServices.mockReset().mockResolvedValue({ business: mockBusiness });
  mockPick.mockReset().mockResolvedValue(photo);
  mockUpload.mockReset().mockResolvedValue('media-1');
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('booking sends actual selected server slot and rupee price; duplicate presses wait for ACK before detail', async () => {
  const saved = deferred();
  mockCreate.mockReturnValue(saved.promise);
  const renderer = render();
  chooseTime(renderer);
  edit(renderer, 'Notes for the business', ' Please call on arrival ');
  await ReactTestRenderer.act(async () => {
    const post = button(renderer, 'Request booking').props.onPress;
    post();
    post();
  });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      providerId: 'provider-1',
      categoryId: 'service-1',
      serviceMode: 'center',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      amount: 750,
      durationMinutes: 60,
      detail: expect.objectContaining({ notes: 'Please call on arrival' }),
    }),
  );
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPrevention.prevent).toBe(true);
  await ReactTestRenderer.act(async () =>
    saved.resolve({ id: 'booking-1', providerId: 'provider-1' }),
  );
  expect(mockReplace).toHaveBeenCalledWith('BookingDetail', {
    bookingId: 'booking-1',
  });
  close(renderer);
});
test('home booking requires address; conflicts keep draft and refresh authoritative availability', async () => {
  mockCreate.mockRejectedValue(
    new ApiError(409, 'slot_unavailable', 'Slot taken'),
  );
  const renderer = render();
  await press(renderer, 'Home visit');
  chooseTime(renderer);
  await press(renderer, 'Request booking');
  expect(mockCreate).not.toHaveBeenCalled();
  edit(renderer, 'Service address', ' 8 Garden Street ');
  edit(renderer, 'Notes for the business', 'Doorbell broken');
  await press(renderer, 'Request booking');
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      category: 'home_service',
      detail: expect.objectContaining({ locationLabel: '8 Garden Street' }),
    }),
  );
  expect(mockRefetch).toHaveBeenCalled();
  expect(text(renderer)).toContain('That time is no longer available.');
  expect(field(renderer, 'Notes for the business').props.value).toBe(
    'Doorbell broken',
  );
  expect(button(renderer, 'Request booking').props.disabled).toBe(true);
  close(renderer);
});
test('uncertain booking result blocks a second create and offers real booking history', async () => {
  mockCreate.mockRejectedValue(new Error('Connection lost'));
  const renderer = render();
  chooseTime(renderer);
  await press(renderer, 'Request booking');
  expect(text(renderer)).toContain('Check My bookings');
  await press(renderer, 'Check My bookings');
  expect(mockNavigate).toHaveBeenCalledWith('MyBookings');
  expect(mockCreate).toHaveBeenCalledTimes(1);
  close(renderer);
});
test('booking ignores old account acknowledgement and guests sign in via logout', async () => {
  const saved = deferred();
  mockCreate.mockReturnValue(saved.promise);
  const renderer = render();
  chooseTime(renderer);
  await press(renderer, 'Request booking');
  mockUser = { id: 'user-2' };
  mockToken = 'token-2';
  ReactTestRenderer.act(() => renderer.update(<BusinessBookingScreen />));
  await ReactTestRenderer.act(async () =>
    saved.resolve({ id: 'booking-1', providerId: 'provider-1' }),
  );
  expect(mockReplace).not.toHaveBeenCalled();
  mockUser = { id: 'temporary-guest' };
  ReactTestRenderer.act(() => renderer.update(<BusinessBookingScreen />));
  await press(renderer, 'Sign in');
  expect(mockLogout).toHaveBeenCalled();
  close(renderer);
});
test('unavailable server slots are disabled and no sample slots are synthesized', () => {
  mockAvailability.slots = [{ ...slot, available: false }];
  const renderer = render();
  const times = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel?.startsWith('Time ') && node.props.onPress,
  );
  expect(times[0].props.disabled).toBe(true);
  expect(button(renderer, 'Request booking').props.disabled).toBe(true);
  mockAvailability = { ...mockAvailability, slots: [] };
  ReactTestRenderer.act(() => renderer.update(<BusinessBookingScreen />));
  expect(
    renderer.root.findAll(
      node =>
        node.props.accessibilityLabel?.startsWith('Time ') &&
        node.props.onPress,
    ),
  ).toHaveLength(0);
  close(renderer);
});
test('owner profile previews picked logo, uploads only on save and retries profile PATCH without repeating upload', async () => {
  mockSaveProfile
    .mockRejectedValueOnce(new Error('Please retry'))
    .mockResolvedValueOnce({ business: mockBusiness });
  const renderer = render('manage');
  await press(renderer, 'Logo gallery');
  expect(mockPick).toHaveBeenCalledWith('library');
  expect(mockUpload).not.toHaveBeenCalled();
  await press(renderer, 'Save business changes');
  expect(mockUpload).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'provider-1' }),
    photo,
    expect.any(Object),
  );
  expect(mockSaveProfile).toHaveBeenCalledWith(
    expect.objectContaining({ logoMediaId: 'media-1' }),
  );
  expect(text(renderer)).toContain('Please retry');
  await press(renderer, 'Save business changes');
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockSaveProfile).toHaveBeenCalledTimes(2);
  expect(text(renderer)).toContain('Changes saved');
  close(renderer);
});
test('service editor sends the complete actual service set and respects validation', async () => {
  mockParams.section = 'services';
  const renderer = render('manage');
  edit(renderer, 'Consultation price (₹)', '900');
  await press(renderer, 'Add Training');
  await press(renderer, 'Save business changes');
  expect(mockSaveServices).toHaveBeenCalledWith({
    services: [
      expect.objectContaining({ categoryId: 'service-1', price: 900 }),
      expect.objectContaining({
        categoryId: 'service-2',
        price: null,
        durationMinutes: 60,
        modes: ['center'],
      }),
    ],
  });
  close(renderer);
});
test('server permission gates analyst to real analytics without owner edits', async () => {
  mockBusiness.viewer = {
    ...mockBusiness.viewer,
    canManage: false,
    canEditServices: false,
    canViewAnalytics: true,
    role: 'analyst',
  };
  const renderer = render('manage');
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  expect(text(renderer)).toContain('6,750');
  expect(text(renderer)).toContain('Not recorded');
  expect(button(renderer, 'Save business changes')).toBeUndefined();
  await press(renderer, 'Manage bookings');
  expect(mockNavigate).toHaveBeenCalledWith('ProviderDashboard', {
    providerId: 'provider-1',
  });
  expect(mockSaveProfile).not.toHaveBeenCalled();
  close(renderer);
});
test('owner account changes abort pending media and cannot PATCH another account', async () => {
  const uploaded = deferred();
  mockUpload.mockReturnValue(uploaded.promise);
  const renderer = render('manage');
  await press(renderer, 'Logo camera');
  await press(renderer, 'Save business changes');
  const signal = mockUpload.mock.calls[0][2];
  mockUser = { id: 'user-2' };
  mockToken = 'token-2';
  ReactTestRenderer.act(() => renderer.update(<BusinessManageScreen />));
  expect(signal.aborted).toBe(true);
  await ReactTestRenderer.act(async () => uploaded.resolve('media-old'));
  expect(mockSaveProfile).not.toHaveBeenCalled();
  close(renderer);
});
test('owner dirty drafts survive unrelated profile refresh and prompt before leaving', () => {
  const renderer = render('manage');
  edit(renderer, 'Business name', 'Mira Atelier');
  mockBusiness = {
    ...mockBusiness,
    stats: { ...mockBusiness.stats, followers: 99 },
  };
  ReactTestRenderer.act(() => renderer.update(<BusinessManageScreen />));
  expect(field(renderer, 'Business name').props.value).toBe('Mira Atelier');
  mockPrevention.callback({ data: { action: { type: 'GO_BACK' } } });
  expect(Alert.alert).toHaveBeenCalledWith(
    'Discard changes?',
    expect.any(String),
    expect.any(Array),
  );
  expect(mockSaveProfile).not.toHaveBeenCalled();
  close(renderer);
});
