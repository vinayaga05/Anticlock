import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { ProfileAvatar, profileInitials } from './ProfileAvatar';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);

describe('ProfileAvatar', () => {
  it('builds initials from the name', () => {
    expect(profileInitials('Urban Fade Barbers')).toBe('UB');
    expect(profileInitials('arjun')).toBe('A');
  });

  it('falls back to initials on load error and recovers when the uri changes', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProfileAvatar name="Broken Studio" uri="https://img/broken.jpg" size={40} business />,
      );
    });
    const image = renderer.root.findByType(Image);
    ReactTestRenderer.act(() => {
      image.props.onError();
    });
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.root.findByType(Text).props.children).toBe('BS');

    ReactTestRenderer.act(() => {
      renderer.update(<ProfileAvatar name="Lotus Yoga" uri="https://img/lotus.jpg" size={40} business />);
    });
    expect(renderer.root.findByType(Image).props.source).toEqual({ uri: 'https://img/lotus.jpg' });
  });
});
