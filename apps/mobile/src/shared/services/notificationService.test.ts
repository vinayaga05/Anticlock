import {
  getInitialNotification,
  onNotificationOpenedApp,
} from '@react-native-firebase/messaging';
import { setBackgroundNotificationHandler } from './notificationService';

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getInitialNotification: jest.fn(),
  onNotificationOpenedApp: jest.fn(),
}));

const opened = jest.mocked(onNotificationOpenedApp);
const initial = jest.mocked(getInitialNotification);
const unsubscribe = jest.fn();
let cleanup: () => void;

beforeEach(() => {
  jest.clearAllMocks();
  opened.mockReturnValue(unsubscribe);
  initial.mockResolvedValue(null);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  cleanup?.();
  jest.restoreAllMocks();
});

it('returns the background-open subscription cleanup and drops late cold-start results', async () => {
  let resolve!: (message: { data: { kind: string } }) => void;
  initial.mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const handler = jest.fn();
  cleanup = setBackgroundNotificationHandler(handler);
  expect(opened).toHaveBeenCalledTimes(1);
  cleanup();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  opened.mock.calls[0][1]({ data: { kind: 'booking' } });
  resolve({ data: { kind: 'booking' } });
  await Promise.resolve();
  expect(handler).not.toHaveBeenCalled();
});

it('delivers active background-open and cold-start messages to the current handler', async () => {
  const message = {
    data: { kind: 'booking' },
    notification: { title: 'Booking' },
  };
  initial.mockResolvedValueOnce(message);
  const handler = jest.fn();
  cleanup = setBackgroundNotificationHandler(handler);
  await Promise.resolve();
  expect(handler).toHaveBeenCalledWith(message.data, message.notification);
  opened.mock.calls[0][1](message);
  expect(handler).toHaveBeenCalledTimes(2);
});
