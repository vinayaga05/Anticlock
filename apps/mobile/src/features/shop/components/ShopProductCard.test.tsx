import React from 'react';
import Renderer from 'react-test-renderer';
import { Image } from 'react-native';
import { ShopProductCard, type ShopProductCardItem } from './ShopProductCard';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);

const product: ShopProductCardItem = {
  id: 'test-product', name: 'Everyday headphones', price: 1999,
  imageUrl: 'https://example.test/headphones.png',
};
let tree: Renderer.ReactTestRenderer;
const render = (item: ShopProductCardItem = product, onPress = jest.fn()) => {
  Renderer.act(() => { tree = Renderer.create(<ShopProductCard product={item} onPress={onPress} />); });
  return onPress;
};
afterEach(() => Renderer.act(() => tree?.unmount()));

it('shows a useful fallback after image failure and retries when the image source changes', () => {
  render();
  Renderer.act(() => tree.root.findByType(Image).props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'shop-product-image-fallback' }).length).toBeGreaterThan(0);
  Renderer.act(() => tree.update(<ShopProductCard product={{ ...product, imageUrl: 'https://example.test/replacement.png' }} />));
  expect(tree.root.findByType(Image).props.source.uri).toBe('https://example.test/replacement.png');
});

it('only advertises a discount when the provided comparison price exceeds the selling price', () => {
  render({ ...product, price: 1000, compareAtPrice: 1250 });
  expect(tree.root.findByProps({ testID: 'shop-product-discount' }).props.children).toEqual([20, '% off']);
  Renderer.act(() => tree.update(<ShopProductCard product={{ ...product, compareAtPrice: 1000 }} />));
  expect(tree.root.findAllByProps({ testID: 'shop-product-discount' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'shop-product-compare-price' })).toHaveLength(0);
});

it('opens the selected product and exposes its price and known stock to accessibility', () => {
  const press = render({ ...product, inventory: 0, isTestProduct: true });
  const button = tree.root.findAll(node => typeof node.props.onPress === 'function' && node.props.accessibilityLabel)[0];
  expect(button.props.accessibilityLabel).toBe('Everyday headphones, ₹1,999, out of stock, test item');
  Renderer.act(() => button.props.onPress());
  expect(press).toHaveBeenCalledTimes(1);
});
