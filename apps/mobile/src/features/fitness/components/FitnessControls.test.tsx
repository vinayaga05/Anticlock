import React from 'react';
import Renderer from 'react-test-renderer';
import { Platform, Pressable } from 'react-native';
import {
  FitnessDatePicker,
  FitnessDisclosure,
  FitnessStepper,
  formatFitnessPickerDate,
  parseFitnessPickerDate,
} from './FitnessControls';
import { FitnessAction, FitnessScreen } from './FitnessUI';
let mockPickerProps: any;
const mockAndroidOpen = jest.fn();
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: (props: any) => {
    mockPickerProps = props;
    return null;
  },
  DateTimePickerAndroid: { open: (...args: any[]) => mockAndroidOpen(...args) },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({ mode: 'light' }),
}));
jest.mock('@/shared/components/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('lucide-react-native', () => {
  const R = require('react');
  return new Proxy(
    {},
    {
      get: (_t, name) =>
        name === '__esModule'
          ? true
          : (props: any) => R.createElement('test-icon', props),
    },
  );
});
const renderers: Renderer.ReactTestRenderer[] = [];
async function render(node: React.ReactElement) {
  let r!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => {
    r = Renderer.create(node);
  });
  renderers.push(r);
  return r;
}
async function press(r: Renderer.ReactTestRenderer, label: string) {
  const target = r.root.findAll(
    n =>
      n.props.accessibilityLabel === label &&
      typeof n.props.onPress === 'function',
  )[0];
  expect(target).toBeDefined();
  await Renderer.act(async () => target.props.onPress());
}
afterEach(() => {
  Renderer.act(() => renderers.splice(0).forEach(r => r.unmount()));
  jest.clearAllMocks();
});
test('date selection stages iOS wheel changes; dismissal preserves the saved date', async () => {
  const change = jest.fn();
  const r = await render(
    <FitnessDatePicker
      label="Date of birth"
      value="1992-08-14"
      onChange={change}
      maximumDate="2026-11-15"
    />,
  );
  await press(r, 'Date of birth');
  expect(formatFitnessPickerDate(mockPickerProps.value, 'date')).toBe(
    '1992-08-14',
  );
  await Renderer.act(async () =>
    mockPickerProps.onValueChange({}, new Date(1993, 6, 2, 12)),
  );
  await press(r, 'Close Date of birth');
  expect(change).not.toHaveBeenCalled();
  await press(r, 'Date of birth');
  await Renderer.act(async () =>
    mockPickerProps.onValueChange({}, new Date(1994, 4, 3, 12)),
  );
  await Renderer.act(async () =>
    r.root.findByType(FitnessAction).props.onPress(),
  );
  expect(change).toHaveBeenCalledWith('1994-05-03');
});
test('native Android selection and cancellation do not change local calendar dates', async () => {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  try {
    const change = jest.fn();
    const r = await render(
      <FitnessDatePicker
        label="Entry date"
        value="2026-11-15"
        onChange={change}
      />,
    );
    await press(r, 'Entry date');
    const options = mockAndroidOpen.mock.calls[0][0];
    expect(formatFitnessPickerDate(options.value, 'date')).toBe('2026-11-15');
    expect(change).not.toHaveBeenCalled();
    await Renderer.act(async () =>
      options.onValueChange({}, new Date(2026, 10, 14, 12)),
    );
    expect(change).toHaveBeenCalledWith('2026-11-14');
  } finally {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }
});
test('date and time round trip in local timezone without UTC midnight conversion', () => {
  expect(
    formatFitnessPickerDate(parseFitnessPickerDate('1990-01-01'), 'date'),
  ).toBe('1990-01-01');
  expect(parseFitnessPickerDate('1990-01-01').getHours()).toBe(12);
  expect(
    formatFitnessPickerDate(parseFitnessPickerDate('07:45', 'time'), 'time'),
  ).toBe('07:45');
});
test('stepper clamps range, supports assistive increment and respects busy screen', async () => {
  const change = jest.fn();
  const r = await render(
    <FitnessStepper
      label="Water"
      value={1000}
      min={50}
      max={1000}
      step={250}
      onChange={change}
    />,
  );
  const increase = r.root.findAll(
    n => n.props.accessibilityLabel === 'Increase Water',
  )[0];
  expect(increase.props.accessibilityState.disabled).toBe(true);
  await press(r, 'Decrease Water');
  expect(change).toHaveBeenCalledWith(750);
  await Renderer.act(async () =>
    r.root
      .findAll(n => n.props.accessibilityRole === 'adjustable')[0]
      .props.onAccessibilityAction({
        nativeEvent: { actionName: 'increment' },
      }),
  );
  expect(change).toHaveBeenLastCalledWith(1000);
  await Renderer.act(async () =>
    r.update(
      <FitnessScreen title="Save" busy>
        <FitnessStepper
          label="Water"
          value={50}
          min={50}
          max={1000}
          onChange={change}
        />
      </FitnessScreen>,
    ),
  );
  const decrease = r.root.findAll(
    n => n.props.accessibilityLabel === 'Decrease Water',
  )[0];
  expect(decrease.props.accessibilityState.disabled).toBe(true);
  expect(
    r.root.findAll(n => n.props.accessibilityRole === 'adjustable')[0].props
      .accessibilityState.disabled,
  ).toBe(true);
});
test('optional details stay out of the tree until expanded and footer stays outside the scroller', async () => {
  const r = await render(
    <FitnessScreen
      title="Today"
      footer={<FitnessAction label="Continue" onPress={() => {}} />}
    >
      <FitnessDisclosure title="More details">
        <FitnessStepper
          label="Private number"
          value={10}
          min={0}
          max={20}
          onChange={() => {}}
        />
      </FitnessDisclosure>
    </FitnessScreen>,
  );
  expect(r.root.findAllByType(FitnessStepper)).toHaveLength(0);
  await press(r, 'More details');
  expect(r.root.findAllByType(FitnessStepper)).toHaveLength(1);
  const action = r.root.findByType(FitnessAction);
  expect(action.props.label).toBe('Continue');
  let node: any = action.parent;
  while (node) {
    expect(node.type).not.toBe('RCTScrollView');
    node = node.parent;
  }
});
