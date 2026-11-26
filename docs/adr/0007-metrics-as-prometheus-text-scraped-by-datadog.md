# ADR 0007: Expose a small Prometheus text page, scraped by the Datadog agent

Status: accepted

## Context
We want request rate, latency, errors and AI cost in Datadog, without adding a heavy metrics library.

## Decision
The API serves `/metrics` in the Prometheus text format from a small in-house registry. Labels are limited to route patterns (never full URLs) to prevent metric explosion. The Datadog agent reads it with an OpenMetrics check configured by pod annotations.

## Consequences
- No extra npm package, and the format is standard.
- The page is internal: nginx does not forward `/metrics`.
- Metric names may need adjusting when the agent adds prefixes. The Week 7 guide explains how to check.

## Alternatives
- `prom-client`: the standard library, and a good choice later.
- Datadog StatsD client: works, but adds a UDP path to manage.
