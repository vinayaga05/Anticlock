import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { PostingAsCard } from './PostingAsCard';

jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    typography: new Proxy({}, { get: () => ({}) }),
    radius: new Proxy({}, { get: () => 8 }),
    spacing: new Proxy({}, { get: () => 8 }),
    mode: 'light',
  }),
}));
jest.mock('@/shared/components/Card', () => {
  const { View } = require('react-native');
  return { Card: ({ children }: any) => <View>{children}</View> };
});
jest.mock('@/shared/components/FilterPills', () => {
  const { Text: RNText } = require('react-native');
  return {
    FilterPills: ({ pills, onChange }: any) =>
      pills.map((pill: any) => (
        <RNText
          key={pill.id}
          testID={`pill-${pill.id}`}
          onPress={() => onChange(pill.id)}>
          {pill.label}
        </RNText>
      )),
  };
});

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
  it('shows "Posting as" with the selected business and a switcher', () => {
    const onSelect = jest.fn();
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <PostingAsCard
          identities={[personal, business]}
          identity={business}
          onSelect={onSelect}
        />,
      );
    });
    expect(texts(renderer)).toEqual(
      expect.arrayContaining([
        'Posting as Lotus Yoga',
        'Business profile',
        'Asha (Personal)',
      ]),
    );
    ReactTestRenderer.act(() => {
      renderer.root.findByProps({ testID: 'pill-u1' }).props.onPress();
    });
    expect(onSelect).toHaveBeenCalledWith('u1');
  });

  it('hides the switcher when only one profile is owned', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <PostingAsCard
          identities={[personal]}
          identity={personal}
          onSelect={jest.fn()}
        />,
      );
    });
    expect(texts(renderer)).toContain('Posting as Asha');
    expect(renderer.root.findAllByProps({ testID: 'pill-u1' })).toHaveLength(0);
  });
});
