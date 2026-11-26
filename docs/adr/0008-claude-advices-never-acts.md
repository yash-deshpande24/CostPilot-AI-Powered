# ADR 0008: Claude advises, and never changes AWS

Status: accepted

## Context
An AI that can change production infrastructure is a serious risk. Its answers can also be wrong.

## Decision
- Claude receives a summary of the bill or a day's numbers, and returns explanations, rankings and answers.
- Claude has no AWS credentials and no tools that change anything.
- AWS names and tags are passed as data. The prompt says to treat them as data, not instructions.
- A daily request limit and cached explanations control cost.
- Pull requests from the app contain fixed, template-built runbooks. The AI text is never used to build a command.

## Consequences
- A wrong answer can waste a person's time, but cannot change AWS on its own.
- Costs are bounded and visible.
- The sample mode works with no key, so the app is usable offline.

## Alternatives
- An agent that applies fixes: faster, but unacceptable without a human approval step.
