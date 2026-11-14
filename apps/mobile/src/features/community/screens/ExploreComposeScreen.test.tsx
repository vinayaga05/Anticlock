import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, TextInput } from 'react-native';
import { CreateExploreEventScreen, CreateExploreProductScreen } from './ExploreComposeScreen';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/ScreenContainer', () => ({ ScreenContainer: ({ children }: any) => children }));
jest.mock('@/shared/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/shared/components/Card', () => ({ Card: ({ children }: any) => children }));
jest.mock('@/shared/components/Button', () => ({ Button: (props: any) => {
  const { Pressable } = require('react-native');
  return <Pressable {...props} />;
} }));
jest.mock('@/shared/components/FilterPills', () => ({ FilterPills: () => null }));
jest.mock('@/shared/publishing/PostingAsCard', () => ({ PostingAsCard: (props: any) => {
  const { View } = require('react-native');
  return <View testID="product-posting-as" {...props} />;
} }));
jest.mock('@/shared/context/AuthProvider', () => ({ useAuth: () => ({ user: { displayName: 'Arun', phone: '+919876543210' } }) }));

const personal = { id: 'personal-1', type: 'user' as const, name: 'Arun', avatarUrl: null };
const business = { id: 'business-1', type: 'provider' as const, name: 'Sports Studio', avatarUrl: null, role: 'owner' };
let mockProfiles: any;
let mockRouteParams: any;
const mockSetActive = jest.fn();
jest.mock('@/shared/publishing/useActiveProfile', () => ({ useActiveProfile: () => mockProfiles }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ popToTop: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
}));

const mockCreateProduct = jest.fn();
const mockSubmitProduct = jest.fn();
const mockUploadMedia = jest.fn();
jest.mock('@/shared/api/shopHooks', () => ({
  useProductCategoriesQuery: () => ({ data: [{ id: 'category-1', name: 'Sports' }] }),
  useProductQuery: () => ({ data: undefined }),
  useCreateUserProductMutation: () => ({ mutateAsync: mockCreateProduct }),
  useUpdateUserProductMutation: () => ({ mutateAsync: jest.fn() }),
  useSubmitUserProductMutation: () => ({ mutateAsync: mockSubmitProduct }),
}));
jest.mock('@/shared/api/exploreHooks', () => ({
  useExploreEventQuery: () => ({ data: undefined }),
  useCreateExploreEventMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateExploreEventMutation: () => ({ mutateAsync: jest.fn() }),
  useSubmitExploreEventMutation: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/shared/api/hooks', () => ({ useServiceCategoriesQuery: () => ({ data: [] }) }));
jest.mock('@/shared/api/publishingHooks', () => ({ uploadContentMedia: (...args: any[]) => mockUploadMedia(...args) }));
jest.mock('@/features/reels/media/clipMediaPicker', () => ({
  pickClipCover: jest.fn(async () => ({ previewSource: 'file:///product.jpg', filename: 'product.jpg' })),
  pickClipVideo: jest.fn(),
  createCoverUploadFile: jest.fn(async () => ({ kind: 'image', filename: 'product.jpg', contentType: 'image/jpeg', byteSize: 123 })),
  createVideoUploadFile: jest.fn(),
}));

function button(renderer: ReactTestRenderer.ReactTestRenderer, title: string) {
  return renderer.root.findAll(node => node.props.title === title && node.props.onPress)[0];
}

describe('business product composer', () => {
  beforeEach(() => {
    mockProfiles = { identities: [personal, business], active: personal, isLoading: false, fallbackApplied: false, setActive: mockSetActive };
    mockRouteParams = { publisherProfileId: business.id, publisherProfileType: 'business' };
    mockSetActive.mockReset();
    mockCreateProduct.mockReset().mockResolvedValue({ id: 'product-1' });
    mockSubmitProduct.mockReset().mockResolvedValue({ id: 'product-1' });
    mockUploadMedia.mockReset().mockResolvedValue('image-1');
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('opens as the route business without switching the globally active personal profile', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CreateExploreProductScreen />); });
    expect(renderer.root.findAll(node => node.props.testID === 'product-posting-as')[0].props.identity).toBe(business);
    expect(mockSetActive).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('preserves the explicit business identity when opening the event composer', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CreateExploreEventScreen />); });
    expect(renderer.root.findAll(node => node.props.testID === 'product-posting-as')[0].props.identity).toBe(business);
    expect(mockSetActive).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('uploads and creates a product under the explicit business publisher, then submits for review', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CreateExploreProductScreen />); });
    ReactTestRenderer.act(() => {
      renderer.root.findAllByType(TextInput).find(node => node.props.placeholder === 'Resistance Band Set')!.props.onChangeText('Training bands');
      renderer.root.findAllByType(TextInput).find(node => node.props.placeholder === 'Tell people what to expect')!.props.onChangeText('A set of resistance bands');
      renderer.root.findAllByType(TextInput).find(node => node.props.keyboardType === 'decimal-pad')!.props.onChangeText('500');
    });
    await ReactTestRenderer.act(async () => { await button(renderer, 'Add image').props.onPress(); });
    await ReactTestRenderer.act(async () => { await button(renderer, 'Submit for Review').props.onPress(); });
    expect(mockUploadMedia.mock.calls[0][0]).toBe(business);
    expect(mockCreateProduct).toHaveBeenCalledWith(expect.objectContaining({
      publisherProfileId: business.id,
      publisherProfileType: 'business',
      name: 'Training bands',
      price: 50000,
      inventory: 1,
      imageIds: ['image-1'],
      requestedVisibility: 'followers_only',
    }));
    expect(mockSubmitProduct).toHaveBeenCalledWith('product-1');
    expect(Alert.alert).toHaveBeenCalledWith('Submitted for review', expect.any(String), expect.any(Array));
    ReactTestRenderer.act(() => renderer.unmount());
  });

  it('blocks unavailable business contexts instead of silently creating a personal product', async () => {
    mockProfiles.identities = [personal];
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CreateExploreProductScreen />); });
    expect(renderer.root.findAll(node => node.props.testID === 'product-posting-as')[0].props.identity).toBeNull();
    await ReactTestRenderer.act(async () => { await button(renderer, 'Save Draft').props.onPress(); });
    expect(mockCreateProduct).not.toHaveBeenCalled();
    expect(mockUploadMedia).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Check your submission', expect.stringContaining('unavailable'));
    ReactTestRenderer.act(() => renderer.unmount());
  });
});
