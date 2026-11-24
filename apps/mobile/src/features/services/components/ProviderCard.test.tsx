import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { ProviderCard } from './ProviderCard';
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/components/Card', () => ({
  Card: (props: any) => require('react').createElement('card', props),
}));
jest.mock('@/shared/components/Glass', () => ({
  Glass: (props: any) => require('react').createElement('glass', props),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('./ProviderCardMedia', () => ({
  ProviderCardMedia: (props: any) =>
    require('react').createElement('card-media', props),
}));
test.each([false, true])(
  'the whole provider row opens the detail page (health=%s) without a separate profile button',
  health => {
    const onPress = jest.fn();
    const provider: any = {
      id: 'doctor',
      name: 'Doctor',
      imageUrl: 'cover.jpg',
      introVideoUrl: 'intro.mp4',
      location: { city: 'Chennai' },
      reviewCount: 0,
    };
    let tree: Renderer.ReactTestRenderer;
    act(() => {
      tree = Renderer.create(
        <ProviderCard
          provider={provider}
          onPress={onPress}
          health={health}
          previewActive
        />,
      );
    });
    const row = health
      ? tree!.root.findAll(
          node =>
            node.props.accessibilityLabel === 'Open Doctor profile' &&
            Boolean(node.props.onPress),
        )[0]
      : tree!.root.findByType('card' as any);
    act(() => row.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(tree!.toJSON())).not.toContain('View profile');
    expect(tree!.root.findByType('card-media' as any).props).toMatchObject({
      imageUrl: 'cover.jpg',
      videoUrl: 'intro.mp4',
      active: true,
    });
    act(() => tree!.unmount());
  },
);
