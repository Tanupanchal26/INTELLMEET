/**
 * AI Provider Factory
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads AI_MODE from the environment and returns the appropriate provider.
 *
 * AI_MODE=demo  → DemoProvider  (no external API calls, always works)
 * AI_MODE=grok  → GrokProvider  (requires GROK_API_KEY)
 * AI_MODE=openai → OpenAIProvider (requires OPENAI_API_KEY)
 *
 * Defaults to demo if AI_MODE is unset or unrecognised.
 */
import type { AIProvider } from './demoProvider';
import { demoProvider }   from './demoProvider';
import { grokProvider }   from './grokProvider';
import { openaiProvider } from './openaiProvider';
import logger from '../../shared/utils/logger';

type AIMode = 'demo' | 'grok' | 'openai';

let _provider: AIProvider | null = null;

export const getAIProvider = (): AIProvider => {
  if (_provider) return _provider;

  const mode = (process.env.AI_MODE || 'demo').toLowerCase() as AIMode;

  switch (mode) {
    case 'grok':
      logger.info('[AI] Provider: Grok (xAI)');
      _provider = grokProvider;
      break;
    case 'openai':
      logger.info('[AI] Provider: OpenAI');
      _provider = openaiProvider;
      break;
    case 'demo':
    default:
      logger.info('[AI] Provider: Demo (AI_MODE=demo — no external API calls)');
      _provider = demoProvider;
      break;
  }

  return _provider;
};

/** Reset the cached provider (useful in tests). */
export const resetAIProvider = () => { _provider = null; };
