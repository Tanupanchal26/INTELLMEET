/**
 * AI Provider Factory
 * ─────────────────────────────────────────────────────────────────────────────
 * Always returns grokProvider.
 * Throws at startup if GROK_API_KEY is not set.
 */
import type { AIProvider } from './demoProvider';
import { grokProvider } from './grokProvider';
import logger from '../../shared/utils/logger';

let _provider: AIProvider | null = null;

export const getAIProvider = (): AIProvider => {
  if (_provider) return _provider;

  if (!process.env.GROK_API_KEY) {
    throw new Error(
      '[AI] GROK_API_KEY is not set. Add it to your .env file to enable AI features.'
    );
  }

  logger.info('[AI] Provider: Grok (grok-4)');
  _provider = grokProvider;
  return _provider;
};

/** Reset the cached provider (useful in tests). */
export const resetAIProvider = () => { _provider = null; };
