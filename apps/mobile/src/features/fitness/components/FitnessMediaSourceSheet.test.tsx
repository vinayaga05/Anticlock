import React from 'react';
import Renderer from 'react-test-renderer';
import { FitnessMediaSourceSheet } from './FitnessMediaSourceSheet';
import { FitnessAction } from './FitnessUI';
const mockPick = jest.fn(),
  mockAcknowledge = jest.fn();
let mockScope = 'first:0';
let mockSeen = false;
jest.mock('../logging/fitnessMediaPicker', () => ({
  pickFitnessMedia: (...args: any[]) => mockPick(...args),
}));
jest.mock('../logging/fitnessLoggingPreferences', () => ({
  useFitnessLoggingPreferences: () => ({
    scope: mockScope,
    mediaNoticeSeen: mockSeen,
    acknowledgeMediaNotice: mockAcknowledge,
  }),
}));
jest.mock('./FitnessControls', () => ({
  FitnessSheet: ({ visible, children }: any) => (visible ? children : null),
}));
jest.mock('./FitnessUI', () => {
  const R = require('react');
  return {
    FitnessAction: (props: any) => R.createElement('action', props),
    FitnessText: (props: any) => R.createElement('text', props),
    FitnessNotice: () => null,
  };
});
const renderers: Renderer.ReactTestRenderer[] = [];
async function render(props: any) {
  let r!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => {
    r = Renderer.create(<FitnessMediaSourceSheet {...props} />);
  });
  renderers.push(r);
  return r;
}
function action(r: Renderer.ReactTestRenderer, label: string) {
  return r.root
    .findAllByType(FitnessAction)
    .find(item => item.props.label === label)!;
}
afterEach(() =>
  Renderer.act(() => renderers.splice(0).forEach(r => r.unmount())),
);
beforeEach(() => {
  mockPick.mockReset();
  mockAcknowledge.mockReset();
  mockScope = 'first:0';
  mockSeen = false;
});
test('shows private notice until successful selection and has no upload action', async () => {
  const close = jest.fn(),
    choose = jest.fn(),
    asset = { uri: 'file:///photo.jpg', name: 'photo.jpg', type: 'image/jpeg' };
  const r = await render({ visible: true, onClose: close, onChoose: choose });
  expect(JSON.stringify(r.toJSON())).toContain(
    'Nothing appears on your public profile',
  );
  mockPick.mockResolvedValueOnce(null);
  await Renderer.act(async () => action(r, 'Take photo').props.onPress());
  expect(choose).not.toHaveBeenCalled();
  expect(mockAcknowledge).not.toHaveBeenCalled();
  mockPick.mockResolvedValueOnce(asset);
  await Renderer.act(async () =>
    action(r, 'Choose photo from gallery').props.onPress(),
  );
  expect(mockPick).toHaveBeenLastCalledWith('library', false);
  expect(choose).toHaveBeenCalledWith(asset);
  expect(close).toHaveBeenCalledTimes(1);
  expect(mockAcknowledge).toHaveBeenCalledTimes(1);
});
test('discards a native picker result after account or data epoch changes and ignores double taps', async () => {
  let finish!: (value: any) => void;
  mockPick.mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  const choose = jest.fn(),
    close = jest.fn();
  const props = {
    visible: true,
    onClose: close,
    onChoose: choose,
    allowVideo: true,
  };
  const r = await render(props);
  await Renderer.act(async () => {
    action(r, 'Take photo').props.onPress();
    action(r, 'Choose from gallery').props.onPress();
  });
  expect(mockPick).toHaveBeenCalledTimes(1);
  mockScope = 'second:1';
  await Renderer.act(async () =>
    r.update(<FitnessMediaSourceSheet {...props} />),
  );
  await Renderer.act(async () =>
    finish({
      uri: 'file:///first-account.jpg',
      type: 'image/jpeg',
      name: 'first.jpg',
    }),
  );
  expect(choose).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(mockAcknowledge).not.toHaveBeenCalled();
});
