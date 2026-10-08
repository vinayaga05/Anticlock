import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { byTestId, countTestId } from '@/test/componentMocks';
import { Text } from 'react-native';
import { PostingAsCard } from './PostingAsCard';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-reanimated', () => require('@/test/componentMocks').reanimatedModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);

const personal = { type: 'user' as const, id: 'u1', name: 'Asha', avatarUrl: null };
const business = {
  type: 'provider' as const,
  id: 'b1',
  name: 'Lotus Yoga',
  avatarUrl: null,
  profileType: 'business' as const,
};

function texts(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(Text)
    .map(node => [node.props.children].flat().join(''));
}

describe('PostingAsCard', () => {
  it('shows the compact preselected business and switches via the sheet', () => {
    const onSelect = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <PostingAsCard identities={[personal, business]} identity={business} onSelect={onSelect} />,
      );
    });
    expect(byTestId(renderer, 'posting-as-name').props.children).toBe('Lotus Yoga');
    expect(texts(renderer)).toContain('Business');
    expect(
      renderer.root.findAll(node => node.props.accessibilityLabel === 'Posting as Lotus Yoga').length,
    ).toBeGreaterThan(0);

    ReactTestRenderer.act(() => {
      byTestId(renderer, 'posting-as-switch').props.onPress();
    });
    ReactTestRenderer.act(() => {
      byTestId(renderer, 'switcher-row-u1').props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('u1');
  });

  it('hides the switcher when only one profile is owned', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <PostingAsCard identities={[personal]} identity={personal} onSelect={jest.fn()} />,
      );
    });
    expect(texts(renderer)).toContain('Asha');
    expect(countTestId(renderer, 'posting-as-switch')).toBe(0);
  });

  it('locks switching while publishing and reports an unavailable profile', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <PostingAsCard
          identities={[personal, business]}
          identity={personal}
          onSelect={jest.fn()}
          disabled
          fallbackApplied
        />,
      );
    });
    expect(byTestId(renderer, 'posting-as-switch').props.disabled).toBe(true);
    expect(texts(renderer)).toContain('Previous profile unavailable');
  });
});
