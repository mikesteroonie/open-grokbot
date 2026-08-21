<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# serverless-bot — agent guidance

Named AI bots ("Chief", "Outbound", …) that users message like colleagues. Each bot is backed by its own AgentMail inbox and acts as a real email participant.

## Versions to verify before writing code

Read local docs/types instead of trusting training data:

- `next` 16.x — `node_modules/next/dist/docs/`
- `ai` 6.x — note `inputSchema` on tool defs, `stopWhen` instead of `maxSteps`, and `convertToModelMessages` is async
- `agentmail` 0.5.x — `node_modules/agentmail/reference.md` and `dist/esm/api/**/*.d.mts`
- `zod` 4.x, Tailwind 4.x, React 19

## Architecture

- `app/page.tsx` — bot roster + chat (client), one mounted chat per bot.
- `app/api/chat/route.ts` — user-initiated turn; streams via the AI SDK.
- `app/api/webhook/agentmail/route.ts` — inbound mail: verify Svix signature, resolve bot by inbox, run the agent loop.
- `lib/bots.ts` — bot registry and per-bot contact lists, backed by AgentMail inbox metadata (no DB).
- `lib/agent.ts` — shared agent loop (`streamChatTurn` / `handleInboundEmail`).
- `lib/tools.ts` — bot tool surface; every mail tool is scoped to the bot's own inbox.
- `components/ui/` — vendored shadcn/ui primitives; `components/ai-elements/` — chat primitives shaped after the AI Elements registry API (overlay with `npx ai-elements@latest`).

## Invariants

- The email thread is a bot's memory. No per-thread database — use AgentMail labels/metadata if you need state.
- Bots only ever send from their own inbox. Never add a code path that sends as the principal or another bot.
- Offline mode (no `AGENTMAIL_API_KEY`) must keep working: mail tools log instead of sending; `pnpm dev` needs zero secrets.
- The webhook must reject unsigned events in production, ignore self-sent mail, and enforce the bot-to-bot loop guard (bounded runs of consecutive bot-only messages per thread) — contacts make bots email each other on purpose, so the guard is what keeps that from becoming an infinite reply chain.
