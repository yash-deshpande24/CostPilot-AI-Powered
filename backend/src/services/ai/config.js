// "claude" when an API key is set, otherwise "mock" (free sample answers built from your own numbers).
export const aiMode = () => (process.env.ANTHROPIC_API_KEY && process.env.AI_MODE !== 'mock' ? 'claude' : 'mock');
export const aiModel = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
export const dailyLimit = () => Number(process.env.AI_DAILY_LIMIT) || 30;
