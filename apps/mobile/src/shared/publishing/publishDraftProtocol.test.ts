import { publishDraftProtocol } from './publishDraftProtocol';

const post = {
  post: { id: 'posted-once', format: 'story', contentStatus: 'published' },
};
const protocol = () => ({
  update: jest.fn().mockResolvedValue({}),
  publish: jest.fn().mockResolvedValue(post),
  acknowledged: jest.fn(),
  wait: jest.fn().mockResolvedValue(undefined),
});

it('recovers the original published post after its first acknowledgement was lost', async () => {
  const steps = protocol();
  // Retry uses the same draft. PATCH is now forbidden because publish won.
  steps.update.mockRejectedValue({ status: 409, code: 'invalid_status' });
  expect(await publishDraftProtocol(steps)).toBe(post);
  expect(steps.publish).toHaveBeenCalledTimes(1);
  expect(steps.acknowledged).toHaveBeenCalledTimes(1);
});

it('does not turn a discarded or removed draft into a successful publication', async () => {
  const steps = protocol();
  steps.update.mockRejectedValue({ status: 409, code: 'invalid_status' });
  const removed = { status: 400, code: 'invalid_status' };
  steps.publish.mockRejectedValue(removed);
  await expect(publishDraftProtocol(steps)).rejects.toBe(removed);
  expect(steps.acknowledged).not.toHaveBeenCalled();
});

it.each([
  null,
  {},
  { post: {} },
  { post: { id: '', contentStatus: 'published' } },
  { post: { id: 'pending', contentStatus: 'processing' } },
])(
  'preserves the draft pointer after a malformed or unconfirmed acknowledgement: %p',
  async response => {
    const steps = protocol();
    steps.publish.mockResolvedValue(response);
    await expect(publishDraftProtocol(steps)).rejects.toThrow();
    expect(steps.acknowledged).not.toHaveBeenCalled();
  },
);

it('retries a processing response on the same draft and clears the pointer only after confirmation', async () => {
  const steps = protocol();
  steps.publish.mockRejectedValueOnce({
    status: 409,
    code: 'media_processing',
  });
  expect(await publishDraftProtocol(steps)).toBe(post);
  expect(steps.update).toHaveBeenCalledTimes(1);
  expect(steps.publish).toHaveBeenCalledTimes(2);
  expect(steps.wait).toHaveBeenCalledWith(1500);
  expect(steps.acknowledged).toHaveBeenCalledTimes(1);
});

it('bounds processing retries and retains the draft when processing never completes', async () => {
  const steps = protocol();
  const processing = { status: 409, code: 'media_processing' };
  steps.publish.mockRejectedValue(processing);
  await expect(publishDraftProtocol(steps)).rejects.toBe(processing);
  expect(steps.publish).toHaveBeenCalledTimes(21);
  expect(steps.acknowledged).not.toHaveBeenCalled();
});

it('does not publish after a metadata permission or validation failure', async () => {
  const steps = protocol();
  const forbidden = { status: 403, code: 'forbidden' };
  steps.update.mockRejectedValue(forbidden);
  await expect(publishDraftProtocol(steps)).rejects.toBe(forbidden);
  expect(steps.publish).not.toHaveBeenCalled();
  expect(steps.acknowledged).not.toHaveBeenCalled();
});
