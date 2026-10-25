import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState } from 'react-native';
import { VideoPlayer } from './VideoPlayer';

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));
jest.mock('@/shared/components/AppIcon', () =>
  require('@/test/componentMocks').appIconModule,
);
jest.mock('react-native-video', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactModule.forwardRef((props: object, _ref: unknown) => (
      <View testID="native-video" {...props} />
    )),
  };
});

describe('VideoPlayer', () => {
  it('pauses a playing video when the video surface is pressed and resumes on the next press', () => {
    AppState.currentState = 'active';
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <VideoPlayer uri="https://cdn.example.com/clip.mp4" muted={false} />,
      );
    });

    const video = () => renderer.root.findByProps({ testID: 'native-video' });
    const toggle = () =>
      renderer.root.findByProps({ testID: 'video-playback-toggle' });

    expect(video().props.paused).toBe(false);
    expect(toggle().props.accessibilityLabel).toBe('Pause video');

    ReactTestRenderer.act(() => {
      toggle().props.onPress();
    });
    expect(video().props.paused).toBe(true);
    expect(toggle().props.accessibilityLabel).toBe('Play video');

    ReactTestRenderer.act(() => {
      toggle().props.onPress();
    });
    expect(video().props.paused).toBe(false);
  });
});
