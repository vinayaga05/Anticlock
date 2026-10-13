import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { MyActivityHub } from './MyActivityHub';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);

describe('MyActivityHub', () => {
  it('renders the live and fitness activity tools requested for the Needs tab', () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<MyActivityHub />);
    });
    const labels = tree.root
      .findAllByType(Text)
      .map(node => node.props.children)
      .filter((value): value is string => typeof value === 'string');

    expect(labels).toEqual(
      expect.arrayContaining([
        'My Activity',
        'Live tracking',
        'Fitness tracking',
        'Health tracking',
        'Walk',
        'Run',
        'Cycle',
        'Swim',
        'Hike',
        'Routines',
        'Food',
        'Strength',
        'Cardio',
        'Flexibility',
        'Sleep',
        'DEE',
        'Water',
        'Vitals',
        'Body',
      ]),
    );
  });
});
