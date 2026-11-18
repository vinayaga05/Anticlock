import {
  movedStoryText,
  publishStorySequence,
  storyPublishFailure,
} from './storyComposerModel';

test('validation failures retain moments and explain service compatibility instead of prompting futile retries', () => {
  const error = Object.assign(new Error('Invalid request'), {
    status: 400,
    code: 'validation_error',
  });
  expect(storyPublishFailure(error, 1)).toContain('1 moment shared.');
  expect(storyPublishFailure(error, 1)).toContain('kept here');
  expect(storyPublishFailure(error, 1)).not.toContain('ready to retry');
  expect(storyPublishFailure(new Error('Connection lost'), 0)).toContain(
    'Connection lost',
  );
  expect(storyPublishFailure(new Error('Connection lost'), 0)).toContain(
    'ready to retry',
  );
});

test('moving a caption normalizes against canvas size and keeps it within the visible canvas', () => {
  expect(movedStoryText(0.5, 0.35, 36, 64, 360, 640)).toEqual({
    textX: 0.6,
    textY: 0.44999999999999996,
  });
  expect(movedStoryText(0.5, 0.35, 5000, -5000, 360, 640)).toEqual({
    textX: 0.9,
    textY: 0.08,
  });
  const zeroCanvas = movedStoryText(0.5, 0.35, -1, 1, 0, 0);
  expect(zeroCanvas).toEqual({ textX: 0.1, textY: 0.8 });
});

test('sequence acknowledges each segment only after server success and stops at the first failure', async () => {
  const acknowledged: string[] = [];
  const publish = jest.fn(async (item: string) => {
    if (item === 'second') throw new Error('Offline');
  });
  await expect(
    publishStorySequence(['first', 'second', 'third'], publish, item =>
      acknowledged.push(item),
    ),
  ).rejects.toThrow('Offline');
  expect(publish.mock.calls.map(call => call[0])).toEqual(['first', 'second']);
  expect(acknowledged).toEqual(['first']);
});
