export async function generateCostExplanation({ question }) {
  // Provider integration intentionally left behind an interface.
  // Add your chosen LLM SDK, input validation, rate limits, and data redaction.
  return {
    answer: `AI provider is not configured. Received question: ${String(question).slice(0, 300)}`,
    provider: 'stub'
  };
}
