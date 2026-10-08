import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { byTestId, countTestId } from '@/test/componentMocks';
import { AccountSettingsScreen } from './AccountSettingsScreen';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-reanimated', () => require('@/test/componentMocks').reanimatedModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}));
jest.mock('@/shared/store/themeStore', () => ({
  useThemeStore: (selector: (state: unknown) => unknown) =>
    selector({ mode: 'light', setMode: jest.fn() }),
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'u1', displayName: 'Arjun Mehta', avatarUrl: null },
    logout: jest.fn(),
  }),
}));
jest.mock('@/features/assistant/components/AssistantPrivacySection', () => ({
  AssistantPrivacySection: () => null,
}));
jest.mock('@/features/assistant/store/assistantStore', () => ({
  useAssistantStore: { getState: () => ({ openAssistant: jest.fn() }) },
}));

const personal = {
  type: 'user' as const,
  id: 'u1',
  name: 'Arjun Mehta',
  avatarUrl: 'https://img/arjun.jpg',
  profileType: 'personal' as const,
};
const lotus = {
  type: 'provider' as const,
  id: 'b1',
  name: 'Lotus Yoga Studio',
  avatarUrl: 'https://img/lotus.jpg',
  profileType: 'business' as const,
  publisher: {
    id: 'b1',
    type: 'business' as const,
    displayName: 'Lotus Yoga Studio',
    handle: 'lotusyoga',
    avatarUrl: 'https://img/lotus.jpg',
    verified: true,
    businessCategory: 'Yoga Studio',
  },
};
const application = (over: Record<string, unknown>) => ({
  providerKind: 'business',
  categoryIds: [],
  submittedAt: null,
  reviewedAt: null,
  infoRequestMessage: null,
  reviewNotes: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...over,
});
const mockApplications = [
  application({ id: 'app-1', businessName: 'Lotus Yoga Studio', status: 'approved', providerId: 'b1' }),
  application({ id: 'app-2', businessName: 'Urban Fade Barbers', status: 'under_review', providerId: null }),
];

let mockActive: typeof personal | typeof lotus = personal;
const mockSetActive = jest.fn();
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({
    identities: [personal, lotus],
    active: mockActive,
    setActive: mockSetActive,
  }),
}));
jest.mock('@/shared/api/providerHooks', () => ({
  useProviderApplicationsQuery: () => ({ data: mockApplications }),
}));

function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<AccountSettingsScreen />);
  });
  const texts = () =>
    renderer.root.findAllByType(Text).map(node => [node.props.children].flat().join(''));
  return { renderer, texts };
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockSetActive.mockClear();
  mockActive = personal;
});

describe('AccountSettingsScreen (profile hub)', () => {
  it('personal active: provider CTA, personal actions, no business section', () => {
    const { renderer, texts } = render();
    expect(byTestId(renderer, 'active-profile-name').props.children).toBe('Arjun Mehta');
    expect(texts()).toEqual(
      expect.arrayContaining(['Personal', 'Edit profile', 'Profile preview', 'Share profile', 'Become a Service Provider']),
    );
    expect(countTestId(renderer, 'section-business')).toBe(0);
    expect(countTestId(renderer, 'become-provider-card')).toBeGreaterThan(0);
    // Pending application surfaces as a state chip on My businesses.
    const labels = renderer.root
      .findAll(node => node.props.testID === 'row-my-businesses' && node.props.accessibilityLabel)
      .map(node => node.props.accessibilityLabel);
    expect(labels[0]).toBe('My businesses, Under review');

    ReactTestRenderer.act(() => byTestId(renderer, 'become-provider-action').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('ProviderApplicationKind');
    ReactTestRenderer.act(() => byTestId(renderer, 'row-profile-preview').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Profile', { profileType: 'personal', profileId: 'u1' });
  });

  it('business active: business actions with status chip, logo card, no CTA', () => {
    mockActive = lotus;
    const { renderer, texts } = render();
    expect(byTestId(renderer, 'active-profile-name').props.children).toBe('Lotus Yoga Studio');
    expect(texts()).toEqual(
      expect.arrayContaining(['Business', '@lotusyoga', 'Business details', 'Approved', 'Post', 'Clip', 'Story']),
    );
    expect(countTestId(renderer, 'section-business')).toBeGreaterThan(0);
    expect(countTestId(renderer, 'become-provider-card')).toBe(0);
    expect(countTestId(renderer, 'row-edit-profile')).toBe(0);

    ReactTestRenderer.act(() => byTestId(renderer, 'row-business-details').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('ProviderApplicationStatus', { applicationId: 'app-1' });
    ReactTestRenderer.act(() => byTestId(renderer, 'row-profile-preview').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Profile', { profileType: 'business', profileId: 'b1' });
  });

  it('hides rows without a destination and never shows technical terms', () => {
    mockActive = lotus;
    const all = render().texts().join(' | ');
    for (const hidden of ['Language', 'Security', 'Manage services', 'Availability', 'Products', 'Earnings']) {
      expect(all).not.toContain(hidden);
    }
    expect(all).not.toMatch(/under_review|publisherProfileId|ownerUserId|provider_id/);
    expect(all).toContain('Log out');
    expect(all).toContain('Help');
  });

  it('switcher: opens from the active card and applies the selection globally', () => {
    const { renderer, texts } = render();
    expect(countTestId(renderer, 'profile-switcher-sheet')).toBe(0);
    ReactTestRenderer.act(() => byTestId(renderer, 'active-profile-card').props.onPress());
    expect(countTestId(renderer, 'profile-switcher-sheet')).toBeGreaterThan(0);
    expect(texts()).toEqual(expect.arrayContaining(['Urban Fade Barbers', 'Under review', 'Add business']));

    ReactTestRenderer.act(() => byTestId(renderer, 'switcher-row-b1').props.onPress());
    expect(mockSetActive).toHaveBeenCalledWith(lotus);
    expect(countTestId(renderer, 'profile-switcher-sheet')).toBe(0);
  });

  it('switcher: add business routes to the existing application flow', () => {
    const { renderer } = render();
    ReactTestRenderer.act(() => byTestId(renderer, 'active-profile-card').props.onPress());
    ReactTestRenderer.act(() => byTestId(renderer, 'switcher-add-business').props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('ProviderApplicationKind');
  });
});
