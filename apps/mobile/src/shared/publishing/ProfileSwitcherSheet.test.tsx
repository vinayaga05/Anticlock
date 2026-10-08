import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { byTestId, countTestId } from '@/test/componentMocks';
import { Text } from 'react-native';
import { ProfileSwitcherSheet } from './ProfileSwitcherSheet';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-reanimated', () => require('@/test/componentMocks').reanimatedModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);

const personal = { type: 'user' as const, id: 'u1', name: 'Arjun Mehta', avatarUrl: 'https://img/a.jpg', profileType: 'personal' as const };
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
    businessCategory: 'Yoga',
  },
};

function render(props: Partial<React.ComponentProps<typeof ProfileSwitcherSheet>> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <ProfileSwitcherSheet
        visible
        onClose={onClose}
        identities={[personal, lotus]}
        activeId="u1"
        onSelect={onSelect}
        {...props}
      />,
    );
  });
  const texts = () =>
    renderer.root.findAllByType(Text).map(node => [node.props.children].flat().join(''));
  return { renderer, onSelect, onClose, texts };
}

describe('ProfileSwitcherSheet', () => {
  it('lists owned profiles as visual rows with type badges and the active state', () => {
    const { renderer, texts } = render({
      pending: [{ id: 'app-2', name: 'Urban Fade Barbers', status: { label: 'Under review', tone: 'info' } }],
      onAddBusiness: jest.fn(),
    });
    expect(texts()).toEqual(
      expect.arrayContaining([
        'Arjun Mehta',
        'Lotus Yoga Studio',
        'Personal',
        'Business',
        'Urban Fade Barbers',
        'Under review',
        'Add business',
      ]),
    );
    const active = byTestId(renderer, 'switcher-row-u1');
    expect(active.props.accessibilityState).toEqual({ selected: true });
    // No technical identifiers or descriptions are rendered.
    expect(texts().join(' ')).not.toMatch(/provider|under_review|b1|u1/);
  });

  it('selecting a profile applies it and closes the sheet', () => {
    const { renderer, onSelect, onClose } = render();
    ReactTestRenderer.act(() => {
      byTestId(renderer, 'switcher-row-b1').props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith(lotus);
    expect(onClose).toHaveBeenCalled();
  });

  it('routes the add-business card and pending rows; personal card only when missing', () => {
    const onAddBusiness = jest.fn();
    const onOpenPending = jest.fn();
    const onAddPersonal = jest.fn();
    const { renderer } = render({
      onAddBusiness,
      onAddPersonal,
      onOpenPending,
      pending: [{ id: 'app-2', name: 'Urban Fade Barbers', status: { label: 'Under review', tone: 'info' } }],
    });
    expect(countTestId(renderer, 'switcher-add-personal')).toBe(0);
    ReactTestRenderer.act(() => {
      byTestId(renderer, 'switcher-add-business').props.onPress();
    });
    expect(onAddBusiness).toHaveBeenCalled();
    ReactTestRenderer.act(() => {
      byTestId(renderer, 'switcher-pending-app-2').props.onPress();
    });
    expect(onOpenPending).toHaveBeenCalledWith('app-2');

    const withoutPersonal = render({ identities: [lotus], activeId: 'b1', onAddPersonal });
    expect(
      countTestId(withoutPersonal.renderer, 'switcher-add-personal'),
    ).toBeGreaterThan(0);
  });
});
