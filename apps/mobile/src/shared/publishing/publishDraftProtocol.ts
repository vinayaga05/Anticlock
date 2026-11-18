export type AcknowledgedPublication = {
  post: { id: string; format: string; contentStatus: string };
};

type DraftPublicationSteps = {
  update: () => Promise<unknown>;
  publish: () => Promise<AcknowledgedPublication>;
  acknowledged: () => void;
  wait: (ms: number) => Promise<void>;
};

function isRequestError(error: unknown, status: number, code: string): boolean {
  const request = error as { status?: unknown; code?: unknown } | null;
  return request?.status === status && request?.code === code;
}

/**
 * Reusing a draft is safe even after a publish response was lost: the server
 * may reject its metadata PATCH once published, but its publish endpoint is
 * idempotent and returns that same post. Never create another draft here.
 */
export async function publishDraftProtocol(
  steps: DraftPublicationSteps,
): Promise<AcknowledgedPublication> {
  try {
    await steps.update();
  } catch (error) {
    if (!isRequestError(error, 409, 'invalid_status')) throw error;
    // A published draft is immutable. The server publish request below will
    // confirm it, or reject if the draft was instead discarded/removed.
  }
  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await steps.publish();
      if (
        typeof result?.post?.id !== 'string' ||
        !result.post.id.trim() ||
        !['published', 'pending_review'].includes(result.post.contentStatus)
      ) {
        throw new Error(
          result?.post?.contentStatus === 'processing'
            ? 'Your media is still processing. Please try sharing again shortly.'
            : 'Publication could not be confirmed. Your draft is saved; please try again.',
        );
      }
      steps.acknowledged();
      return result;
    } catch (error) {
      if (isRequestError(error, 409, 'media_processing') && attempt < 20) {
        await steps.wait(1_500);
        continue;
      }
      throw error;
    }
  }
}
