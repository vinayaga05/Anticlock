import React, { useEffect } from 'react';
import Renderer, { act } from 'react-test-renderer';
import { ReleaseRouteGuard } from './ReleaseRouteGuard';

jest.mock('react-native', () => ({ Platform: { OS: 'android' }, View: 'View', Text: 'Text', Button: 'Button' }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

test('a direct health link never mounts its screen or runs its data effects', () => {
  const fetchPrivateData = jest.fn();
  function HealthScreen() { useEffect(fetchPrivateData, []); return null; }
  let tree!: Renderer.ReactTestRenderer;
  act(() => { tree = Renderer.create(<ReleaseRouteGuard route={{ name: 'FitnessAssessment' }}><HealthScreen /></ReleaseRouteGuard>); });
  expect(fetchPrivateData).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

test('a permitted service screen still mounts normally', () => {
  const loadServices = jest.fn();
  function ServiceScreen() { useEffect(loadServices, []); return null; }
  let tree!: Renderer.ReactTestRenderer;
  act(() => { tree = Renderer.create(<ReleaseRouteGuard route={{ name: 'ServiceCategory', params: { categoryId: 'home.plumber' } }}><ServiceScreen /></ReleaseRouteGuard>); });
  expect(loadServices).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
