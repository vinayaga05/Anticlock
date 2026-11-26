import React from 'react';
import Renderer from 'react-test-renderer';
import { Platform, TextInput } from 'react-native';
import { MapLocationField } from './MapLocationField';

const mockSearch = jest.fn(), mockReverse = jest.fn(), mockLocate = jest.fn(), mockSave = jest.fn();
jest.mock('../utils/placeSearch', () => ({ formatCoordinates: (point: any) => `${point.latitude}, ${point.longitude}`, searchPlaces: (...args: any[]) => mockSearch(...args), reversePlace: (...args: any[]) => mockReverse(...args) }));
jest.mock('../utils/deviceLocation', () => ({ readCurrentPosition: () => mockLocate() }));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/shared/components/Button', () => ({ Button: ({ title, ...props }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable {...props} accessibilityLabel={title}><Text>{title}</Text></Pressable>; } }));
jest.mock('react-native-maps', () => {
  const React = require('react'); const { View } = require('react-native');
  return { __esModule: true, PROVIDER_GOOGLE: 'google', default: React.forwardRef((props: any, ref: any) => { React.useImperativeHandle(ref, () => ({ animateToRegion: jest.fn() })); return <View {...props} testID="business-map" />; }) };
});
let tree: Renderer.ReactTestRenderer;
const descriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const place = { latitude: 13.01, longitude: 80.23, address: '10 Test Road, Chennai', city: 'Chennai', pincode: '600020' };
const button = (name: string) => tree.root.findAll(node => node.props.accessibilityLabel === name && node.props.onPress)[0];
const map = () => tree.root.findAll(node => node.props.testID === 'business-map' && node.props.onMapLoaded)[0];
async function press(name: string) { await Renderer.act(async () => button(name).props.onPress()); }
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockSearch.mockResolvedValue([place]); mockReverse.mockResolvedValue({ ...place, address: 'Exact business entrance' }); mockLocate.mockRejectedValue(new Error('Location permission was denied. Search or move the pin manually.')); });
afterEach(() => { Renderer.act(() => tree.unmount()); Object.defineProperty(Platform, 'OS', descriptor); jest.useRealTimers(); });

test.each(['ios', 'android'])('%s searches, moves, confirms and restores a pin after denied GPS', async platform => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  await Renderer.act(async () => { tree = Renderer.create(<MapLocationField value={null} addressQuery="" onChange={mockSave} />); });
  await press('Choose on map');
  expect(mockLocate).not.toHaveBeenCalled(); expect(mockSearch).not.toHaveBeenCalled();
  await Renderer.act(async () => map().props.onMapLoaded());
  expect(button('Confirm location').props.disabled).toBe(true);
  await press('Confirm location'); expect(mockSave).not.toHaveBeenCalled();
  await press('Use my current location'); expect(mockLocate).toHaveBeenCalledTimes(1);
  Renderer.act(() => tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Search business address')!.props.onChangeText('Test Road'));
  await press('Find address'); await press(place.address);
  await Renderer.act(async () => map().props.onRegionChangeComplete({ latitude: 13.012, longitude: 80.234 }, { isGesture: true }));
  await Renderer.act(async () => jest.advanceTimersByTime(400));
  await press('Confirm location');
  expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ latitude: '13.012000', longitude: '80.234000', pinConfirmed: true, address: 'Exact business entrance' }));
  const saved = mockSave.mock.calls[0][0];
  await Renderer.act(async () => tree.update(<MapLocationField value={saved} addressQuery={saved.address} onChange={mockSave} />));
  await press('Adjust on map');
  expect(map().props.initialRegion).toMatchObject({ latitude: 13.012, longitude: 80.234 });
  expect(tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Suggested business address')!.props.value).toBe(saved.address);
});

test('map/search failures retain the draft and expose Retry; cancelling never saves it', async () => {
  await Renderer.act(async () => { tree = Renderer.create(<MapLocationField value={null} addressQuery="Test Road" onChange={mockSave} />); });
  await press('Choose on map');
  mockSearch.mockRejectedValueOnce(new Error('Offline'));
  await press('Find address'); expect(button('Retry')).toBeDefined();
  await press('Retry'); await press(place.address);
  await Renderer.act(async () => jest.advanceTimersByTime(15_000));
  expect(button('Retry map')).toBeDefined(); expect(button('Confirm location').props.disabled).toBe(true);
  await press('Retry map');
  expect(map().props.initialRegion).toMatchObject({ latitude: place.latitude, longitude: place.longitude });
  expect(tree.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Suggested business address')!.props.value).toBe(place.address);
  await press('Cancel'); expect(mockSave).not.toHaveBeenCalled();
});
