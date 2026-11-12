import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, StyleSheet } from 'react-native';
import { ProviderIntroVideoSection } from './ProviderIntroVideoSection';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: any) => React.createElement('View', props, children),
      createAnimatedComponent: (Component: any) => Component,
    },
    Easing: { inOut: () => undefined, quad: undefined },
    FadeInDown: { duration: () => ({ delay: () => ({}) }) },
    useAnimatedStyle: () => ({}),
    useSharedValue: (value: number) => ({ value }),
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values[0],
    withTiming: (value: unknown) => value,
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const Mock = ({ children, ...props }: any) => React.createElement('Svg', props, children);
  return {
    __esModule: true,
    default: Mock,
    Svg: Mock,
    Defs: Mock,
    LinearGradient: Mock,
    Rect: Mock,
    Stop: Mock,
  };
});

describe('ProviderIntroVideoSection', () => {
  it('renders a featured intro card with placeholder when poster is missing', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProviderIntroVideoSection
          clips={[
            {
              id: 'clip-1',
              title: '',
              author: 'Plumber',
              caption: 'Introduction',
              videoUrl: 'https://cdn.example/intro.mp4',
              posterUrl: '',
              likeCount: 0,
              commentCount: 0,
            },
          ]}
          providerName="Plumber"
          clipCount={1}
          sideFacts={[]}
          onOpenClip={jest.fn()}
        />,
      );
    });

    expect(
      renderer.root.findAll(
        node => node.props.accessibilityLabel === 'Play intro clip from Plumber',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAll(node =>
        Array.isArray(node.children) &&
        node.children.some(child => child === 'Intro video'),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAll(node =>
        Array.isArray(node.children) && node.children.some(child => child === 'Intro'),
      ).length,
    ).toBeGreaterThan(0);
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.root.findAll(node => node.props.testID === 'icon-reels').length).toBeGreaterThan(0);
  });

  it('keeps a placeholder after a poster fails and retries when its URL changes', () => {
    const onOpenClip = jest.fn();
    const props = {
      clips: [],
      providerName: 'Plumber',
      sideFacts: [],
      onOpenClip,
    };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ProviderIntroVideoSection {...props} fallbackPosterUrl="https://cdn.example/broken.jpg" />,
      );
    });

    expect(StyleSheet.flatten(renderer.root.findByType(Image).props.style)).toMatchObject({
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    });
    const playOverlays = renderer.root.findAll(node =>
      node.props.pointerEvents === 'none' &&
      StyleSheet.flatten(node.props.style)?.justifyContent === 'center',
    );
    expect(playOverlays.length).toBeGreaterThan(0);
    expect(StyleSheet.flatten(playOverlays[0].props.style)).toMatchObject({
      position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    });

    ReactTestRenderer.act(() => {
      renderer.root.findByType(Image).props.onError();
    });
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.root.findAll(node => node.props.testID === 'icon-reels').length).toBeGreaterThan(0);

    ReactTestRenderer.act(() => {
      renderer.update(
        <ProviderIntroVideoSection {...props} fallbackPosterUrl="https://cdn.example/new.jpg" />,
      );
    });
    expect(renderer.root.findByType(Image).props.source.uri).toBe('https://cdn.example/new.jpg');
  });
});
