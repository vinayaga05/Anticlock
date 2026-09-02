import type { AiProviderConfig, AiProviderName } from '../../config/ai-provider.config.js';
import { loadAiProviderConfig } from '../../config/ai-provider.config.js';
import { createGroqProvider } from './GroqAiProvider.js';
import { createOpenAiProvider } from './OpenAiProvider.js';
import {
  assertCircuitClosed,
  backoffDelayMs,
  recordProviderFailure,
  recordProviderSuccess,
  sleep,
  withTimeout,
} from './resilience.js';
import type {
  AiProvider,
  AssistantAgentInput,
  AssistantAgentOutput,
  ProviderCallTelemetry,
} from './types.js';
import { AiProviderError } from './types.js';

export function createAiProvider(
  config: AiProviderConfig,
  provider: AiProviderName,
): AiProvider {
  if (provider === 'groq') {
    return createGroqProvider(
      config.groq.apiKey!,
      config.groq.baseURL,
      config.groq.model,
    );
  }
  return createOpenAiProvider(
    config.openai.apiKey!,
    config.openai.baseURL,
    config.openai.model,
  );
}

export class AiProviderService {
  constructor(private readonly config: AiProviderConfig) {}

  async generateAssistantResponse(
    input: AssistantAgentInput,
  ): Promise<{ output: AssistantAgentOutput; telemetry: ProviderCallTelemetry }> {
    const started = Date.now();
    let fallbackUsed = false;

    try {
      const output = await this.callWithResilience(this.config.activeProvider, input);
      await recordProviderSuccess(this.config.activeProvider);
      return {
        output,
        telemetry: {
          provider: output.provider,
          model: output.model,
          fallbackUsed: false,
          latencyMs: Date.now() - started,
          tokenUsage: output.usage,
        },
      };
    } catch (primaryErr) {
      const primaryError =
        primaryErr instanceof AiProviderError
          ? primaryErr
          : new AiProviderError(String(primaryErr), 'unknown', undefined, false);

      await recordProviderFailure(this.config.activeProvider);

      const fallback = this.config.fallbackProvider;
      if (
        !fallback ||
        fallback === this.config.activeProvider ||
        !primaryError.retryable
      ) {
        throw primaryError;
      }

      fallbackUsed = true;
      const output = await this.callWithResilience(fallback, input, true);
      await recordProviderSuccess(fallback);
      return {
        output,
        telemetry: {
          provider: output.provider,
          model: output.model,
          fallbackUsed: true,
          failureCategory: primaryError.category,
          latencyMs: Date.now() - started,
          tokenUsage: output.usage,
        },
      };
    }
  }

  private async callWithResilience(
    providerName: AiProviderName,
    input: AssistantAgentInput,
    isFallback = false,
  ): Promise<AssistantAgentOutput> {
    await assertCircuitClosed(providerName);
    const provider = createAiProvider(this.config, providerName);
    const maxAttempts = isFallback ? 1 : this.config.maxRetries + 1;

    let lastError: AiProviderError | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await withTimeout(
          signal =>
            (provider as AiProvider & {
              generateAssistantResponse: (
                i: AssistantAgentInput,
                s?: AbortSignal,
              ) => Promise<AssistantAgentOutput>;
            }).generateAssistantResponse(input, signal),
          this.config.requestTimeoutMs,
        );
      } catch (err) {
        lastError =
          err instanceof AiProviderError
            ? err
            : new AiProviderError(String(err), 'unknown', undefined, false);
        if (!lastError.retryable || attempt >= maxAttempts - 1) {
          throw lastError;
        }
        await sleep(backoffDelayMs(attempt));
      }
    }

    throw lastError ?? new AiProviderError('Provider call failed', 'unknown', undefined, false);
  }
}

let cachedService: AiProviderService | null = null;

export function getAiProviderService(config?: AiProviderConfig) {
  if (!cachedService) {
    cachedService = new AiProviderService(config ?? loadAiProviderConfig());
  }
  return cachedService;
}

export function resetAiProviderServiceForTests() {
  cachedService = null;
}
