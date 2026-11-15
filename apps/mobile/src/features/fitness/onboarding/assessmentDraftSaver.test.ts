import type { FitnessAssessment, FitnessProfile } from '@anticlock/contracts';
import { AssessmentDraftSaver } from './assessmentDraftSaver';
import { initialAssessment } from './assessmentModel';

function profile(assessment: FitnessAssessment): FitnessProfile {
  return {
    id: 'profile-a',
    assessment,
    status: 'draft',
    baseline: null,
    completedAt: null,
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const queues: AssessmentDraftSaver[] = [];
function queue(write: jest.Mock, defaults: FitnessAssessment = {}) {
  const saver = new AssessmentDraftSaver(write, defaults);
  queues.push(saver);
  return saver;
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  queues.splice(0).forEach(saver => saver.dispose());
  jest.useRealTimers();
});

test('new profile defaults do not trigger a save or make up physical values', async () => {
  const write = jest.fn().mockResolvedValue(undefined);
  const saver = queue(write, initialAssessment());
  saver.hydrate(null);
  await jest.advanceTimersByTimeAsync(5000);
  await saver.flush();
  expect(write).not.toHaveBeenCalled();
  expect(saver.getSnapshot().draft.heightCm).toBeUndefined();
  expect(saver.getSnapshot().draft.weightKg).toBeUndefined();
  expect(saver.hasChanges()).toBe(false);
});
test('debouncing coalesces changes and serializes the latest edits behind an active request', async () => {
  const first = deferred<{ profile: FitnessProfile }>();
  const write = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockImplementation(async (patch: any) => ({
      profile: profile({ heightCm: patch.heightCm, gender: patch.gender }),
    }));
  const saver = queue(write);
  saver.hydrate(profile({}));
  saver.update('heightCm', 169);
  saver.update('heightCm', 170);
  await jest.advanceTimersByTimeAsync(650);
  expect(write).toHaveBeenCalledTimes(1);
  expect(write.mock.calls[0][0]).toEqual({ heightCm: 170 });
  saver.update('heightCm', 171);
  saver.update('gender', 'Woman');
  await jest.advanceTimersByTimeAsync(1000);
  expect(write).toHaveBeenCalledTimes(1);
  const flushed = saver.flush();
  first.resolve({ profile: profile({ heightCm: 170 }) });
  await flushed;
  expect(write).toHaveBeenCalledTimes(2);
  expect(write.mock.calls[1][0]).toEqual({ heightCm: 171, gender: 'Woman' });
  expect(saver.getSnapshot().draft.heightCm).toBe(171);
  expect(saver.getSnapshot().status).toBe('saved');
});
test('hydration and server acknowledgements cannot overwrite newer local answers', async () => {
  const first = deferred<{ profile: FitnessProfile }>();
  const write = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue(undefined);
  const saver = queue(write);
  saver.update('medicalConditions', 'My new private note');
  saver.hydrate(
    profile({
      medicalConditions: 'Older saved note',
      medications: 'Saved medication',
    }),
  );
  expect(saver.getSnapshot().draft.medicalConditions).toBe(
    'My new private note',
  );
  expect(saver.getSnapshot().draft.medications).toBe('Saved medication');
  await jest.advanceTimersByTimeAsync(650);
  saver.update('medicalConditions', 'Edited during save');
  saver.hydrate(profile({ medicalConditions: 'A stale refetch' }));
  const flushed = saver.flush();
  first.resolve({
    profile: profile({
      medicalConditions: 'My new private note',
      medications: 'Saved medication',
    }),
  });
  await flushed;
  expect(saver.getSnapshot().draft.medicalConditions).toBe(
    'Edited during save',
  );
  expect(write.mock.calls[1][0]).toEqual({
    medicalConditions: 'Edited during save',
  });
});
test('failure keeps answers, rejects flush, and retries explicit private null clears', async () => {
  const write = jest
    .fn()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValue(undefined);
  const saver = queue(write);
  saver.hydrate(
    profile({
      pregnant: true,
      medicalConditions: 'A private saved note',
      weightKg: 70,
    }),
  );
  saver.update('pregnant', undefined);
  saver.update('medicalConditions', undefined);
  await expect(saver.flush()).rejects.toThrow('Offline');
  expect(saver.getSnapshot().status).toBe('error');
  expect(saver.getSnapshot().draft.weightKg).toBe(70);
  expect(saver.getSnapshot().draft.pregnant).toBeUndefined();
  await saver.flush();
  expect(write.mock.calls[0][0]).toEqual({
    pregnant: null,
    medicalConditions: null,
  });
  expect(write.mock.calls[1][0]).toEqual(write.mock.calls[0][0]);
  expect(saver.hasChanges()).toBe(false);
});
test('disposing an owner aborts its transport and prevents queued follow-up writes', async () => {
  const first = deferred<void>();
  const write = jest.fn().mockReturnValue(first.promise);
  const saver = queue(write);
  saver.hydrate(profile({}));
  saver.update('injuries', 'Owner A private note');
  await jest.advanceTimersByTimeAsync(650);
  saver.update('injuries', 'Newer private note');
  saver.dispose();
  expect(write.mock.calls[0][1].aborted).toBe(true);
  first.resolve();
  await Promise.resolve();
  await jest.advanceTimersByTimeAsync(1000);
  expect(write).toHaveBeenCalledTimes(1);
});
test('a fast acknowledgement does not bypass the debounce for newer typing', async () => {
  const first = deferred<void>();
  const write = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValue(undefined);
  const saver = queue(write);
  saver.hydrate(profile({}));
  saver.update('routine', 'First entry');
  await jest.advanceTimersByTimeAsync(650);
  saver.update('routine', 'Second entry');
  await jest.advanceTimersByTimeAsync(100);
  first.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(write).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(549);
  expect(write).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(write).toHaveBeenCalledTimes(2);
  expect(write.mock.calls[1][0]).toEqual({ routine: 'Second entry' });
});
test('a lost acknowledgement followed by a reverted answer still reasserts the latest value', async () => {
  const write = jest
    .fn()
    .mockRejectedValueOnce(new Error('Acknowledgement lost'))
    .mockResolvedValue(undefined);
  const saver = queue(write);
  saver.hydrate(profile({ weightKg: 70 }));
  saver.update('weightKg', 71);
  await expect(saver.flush()).rejects.toThrow('Acknowledgement lost');
  saver.update('weightKg', 70);
  expect(saver.hasChanges()).toBe(true);
  await saver.flush();
  expect(write.mock.calls[1][0]).toEqual({ weightKg: 70 });
  expect(saver.hasChanges()).toBe(false);
});
