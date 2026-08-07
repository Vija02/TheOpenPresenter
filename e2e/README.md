# E2E Tests

`yarn playwright test`

## AI tests

The AI specs (`tests/integration/layout/layoutAi.spec.ts`) run the real AI path —
capability route, SSE transport, agent loop, layout tools — against a fake
OpenAI-compatible provider (`scripts/fakeAiServer.ts`). Only the model is faked.

Playwright starts the fake and points the app server at it via `webServer.env`,
so `yarn playwright test` is all that is needed. But `reuseExistingServer` means
a dev server already on 5678 is used as-is, and that one carries the real
`AI_API_KEY` from `.env`. The specs detect this and skip rather than spend real
credits; stop the dev server to run them. In CI it is a hard failure instead.
