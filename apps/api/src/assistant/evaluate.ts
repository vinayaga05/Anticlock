import 'dotenv/config';
import { createAiProvider } from './ai/AiProviderService.js';
import { evaluateGenieOutput, GENIE_EVAL_CASES } from './evals.js';
import { loadAiProviderConfig } from '../config/ai-provider.config.js';

const systemPrompt = `You are Genie, the assistant for the Knock lifestyle services app.
Use an approved tool whenever the user wants an app action or discovery result.
Use resolve_service_category for services such as plumbers, yoga, doctors, and trainers.
Use open_shop_search for products. Use search_reels for clips.
Do not invent routes, catalog IDs, prices, availability, or actions.`;

async function main() {
  const config = loadAiProviderConfig();
  const provider = createAiProvider(config, config.activeProvider);
  let failures = 0;

  for (const evalCase of GENIE_EVAL_CASES) {
    const output = await provider.generateAssistantResponse({
      systemPrompt,
      messages: [{ role: 'user', content: evalCase.userMessage }],
    });
    const result = evaluateGenieOutput(evalCase, output);
    if (!result.passed) failures += 1;
    console.log(
      JSON.stringify({
        caseId: result.caseId,
        passed: result.passed,
        failures: result.failures,
        toolNames: output.toolCalls.map(call => call.name),
        provider: output.provider,
        model: output.model,
      }),
    );
  }

  if (failures > 0) {
    console.error(`${failures} Genie evaluation case(s) failed.`);
    process.exitCode = 1;
  }
}

void main();
