import Anthropic from '@anthropic-ai/sdk';
import { aiModel } from './config.js';
import { httpError } from './errors.js';

let client;
const defaultCaller = (params) => {
  client ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45000, maxRetries: 2 });
  return client.messages.create(params);
};
let caller = defaultCaller;
export const _setCaller = (fn) => { caller = fn || defaultCaller; }; // for tests

const read = (msg) => ({
  text: (msg.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim(),
  usage: { input: msg.usage?.input_tokens || 0, output: msg.usage?.output_tokens || 0 },
});

// One request to Claude. With a tool, the answer comes back as structured JSON in the tool call.
// tool_choice stays "auto" because some models reject a forced tool; the system prompt says to call it.
export async function ask({ system, messages, tool, maxTokens = 3000 }) {
  const params = { model: aiModel(), max_tokens: maxTokens, system, messages };
  if (tool) {
    params.tools = [tool];
    params.tool_choice = { type: 'auto' };
  }

  let used = { input: 0, output: 0 };
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await caller(params);
    const { text, usage } = read(msg);
    used = { input: used.input + usage.input, output: used.output + usage.output };

    if (!tool) {
      if (!text) throw httpError(502, 'Claude returned an empty answer. Try again.');
      return { text, usage: used };
    }
    const block = (msg.content || []).find((b) => b.type === 'tool_use' && b.name === tool.name);
    if (block && msg.stop_reason !== 'max_tokens') return { input: block.input, usage: used };
    if (msg.stop_reason === 'max_tokens') break; // cut off mid-answer, retrying will not help
  }
  throw httpError(502, 'Claude did not return a usable answer. Try again.');
}
