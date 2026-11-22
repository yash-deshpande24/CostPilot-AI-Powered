export const httpError = (status, message) => Object.assign(new Error(message), { status, userMessage: message });

// Turns Anthropic SDK errors into messages a person can act on. The raw error is logged, not shown.
export function friendlyAiError(e) {
  if (e?.userMessage) return e;
  console.error('AI call failed:', e?.status, e?.message);
  if (e?.status === 401 || e?.status === 403) return httpError(502, 'The Claude API key was rejected. Check ANTHROPIC_API_KEY in your .env file.');
  if (e?.status === 429) return httpError(502, 'Claude is rate limiting requests right now. Try again in a minute.');
  if (e?.status === 404 || e?.status === 400) return httpError(502, 'Claude could not run this request. Check that ANTHROPIC_MODEL is a valid model name.');
  return httpError(502, 'Could not reach Claude. Check your internet connection and try again.');
}
