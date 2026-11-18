import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import { PressableScale } from '@/shared/components/PressableScale';
import { FlashShareSheet } from './FlashShareSheet';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('@/shared/services/engagementRepository', () => ({
  useEngagementStore: (select: any) => select({ shareContent: jest.fn() }),
}));
jest.mock('@/shared/data/mocks', () => ({ conversations: [] }));

it('hands the native Community alert to the feed blocker before closing sharing', () => {
  const nativeAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const showAlert = jest.fn();
  const onClose = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  try {
    Renderer.act(() => {
      tree = Renderer.create(<FlashShareSheet postId="post" visible onClose={onClose} showAlert={showAlert} />);
    });
    const action = tree.root.findAllByType(PressableScale).find(node =>
      node.findAllByType(Text).some(text => text.props.children === 'Share to a Community'),
    );
    expect(action).toBeDefined();
    Renderer.act(() => action!.props.onPress());
    expect(showAlert).toHaveBeenCalledWith('Coming soon', 'Community share will land in a later pass.');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(showAlert.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
    expect(nativeAlert).not.toHaveBeenCalled();
  } finally {
    Renderer.act(() => tree?.unmount());
    nativeAlert.mockRestore();
  }
});
