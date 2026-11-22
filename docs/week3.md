# Week 3: Claude explains, ranks and answers

## What was added
- **Explain this** on every unusual day in the Overview tab: what changed, possible causes, what to check.
- **Rank with AI** on the Savings tab: orders the waste findings, with a risk level, effort and a one-line reason.
- **Ask AI** tab: chat about your bill. History is saved per user.
- **Sample mode:** with no `ANTHROPIC_API_KEY`, every AI feature still works, using answers built from your own numbers. Nothing is sent anywhere.
- **Daily limit** (`AI_DAILY_LIMIT`, default 30 requests per user) and token counts per day, ready for the Week 7 Datadog dashboard.

## Using the real Claude API
1. Create an API key in the Anthropic Console (console.anthropic.com).
2. In `.env` set `ANTHROPIC_API_KEY=...`. Optionally set `ANTHROPIC_MODEL` (default `claude-haiku-5-5`).
3. `docker compose up -d --build`. The Ask AI tab then says "Answers written by Claude".
4. Never commit `.env`.

## API
| Method | Path | Description |
|---|---|---|
| GET | /api/ai/status | Mode, model, requests used today, tokens |
| POST | /api/ai/explain | Body `{"date":"2026-11-13"}` |
| POST | /api/ai/rank | Ranks the active waste findings |
| POST | /api/ai/chat | Body `{"question":"..."}` |
| GET / DELETE | /api/ai/chat | Read or clear your chat history |

## Safety
- The AI only advises. It has no access to AWS.
- AWS data (resource names, tags) is sent inside tags and the prompt says to treat it as data, not instructions.
- Your API key stays on the server and never reaches the browser.
- Error messages never include the key.
- Results are limited per user per day.
