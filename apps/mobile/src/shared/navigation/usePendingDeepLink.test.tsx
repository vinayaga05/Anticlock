import React from 'react';
import Renderer from 'react-test-renderer';
import { Linking } from 'react-native';
import { storePendingDeepLink, usePendingDeepLink } from './usePendingDeepLink';

const mockStorage = new Map<string, string>();
let mockReady = true;
let mockStateListener: (() => void) | undefined;
jest.mock('react-native-mmkv', () => ({ createMMKV: () => ({ set: (key: string, value: string) => mockStorage.set(key, value), getString: (key: string) => mockStorage.get(key), remove: (key: string) => mockStorage.delete(key) }) }));
jest.mock('./rootNavigation', () => ({ rootNavigationRef: { isReady: () => mockReady, addListener: (_event: string, listener: () => void) => { mockStateListener = listener; return () => { mockStateListener = undefined; }; } } }));
function Probe({ completed }: { completed: boolean }) { usePendingDeepLink(completed); return null; }
beforeEach(() => { jest.clearAllMocks(); mockStorage.clear(); mockReady = true; mockStateListener = undefined; jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined); });
afterEach(() => jest.restoreAllMocks());

test('holds an ID-based profile link throughout setup and opens it once after completion', async () => {
  const url = 'anticlock://profile/immutable-user-id';
  storePendingDeepLink(url);
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Probe completed={false} />); });
  expect(Linking.openURL).not.toHaveBeenCalled();
  await Renderer.act(async () => tree.update(<Probe completed />));
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(Linking.openURL).toHaveBeenCalledWith(url);
  await Renderer.act(async () => mockStateListener?.());
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  Renderer.act(() => tree.unmount());
});
test('waits for the navigator instead of dropping a cold-start link', async () => {
  mockReady = false;
  storePendingDeepLink('anticlock://profile/id');
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Probe completed />); });
  expect(Linking.openURL).not.toHaveBeenCalled();
  mockReady = true;
  await Renderer.act(async () => mockStateListener?.());
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  Renderer.act(() => tree.unmount());
});
