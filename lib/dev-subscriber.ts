import { getAgentMail } from "./agentmail";
import { listBots } from "./bots";
import { env, isOffline } from "./env";
import { processInboundEvent } from "./inbound";

/**
 * Development-only inbound mail, with zero setup.
 *
 * `pnpm dev` can't receive webhooks (localhost isn't reachable), so the
 * dev server instead subscribes to AgentMail's WebSocket event stream and
 * hands `message.received` events to the same handler the webhook uses.
 * Clone, add two keys, email a bot — it answers.
 *
 * This is deliberately dev-only: a held-open socket is a standing process,
 * which is the thing the architecture avoids in production. Production
 * uses the signed webhook (see scripts/register-webhook.mjs).
 */

const RESUBSCRIBE_MS = 60_000;

type Socket = Awaited<ReturnType<ReturnType<typeof getAgentMail>["websockets"]["connect"]>>;

declare global {
  // Survives Turbopack/HMR module re-evaluation in the dev server.
  var __serverlessBotDevSocket: Socket | undefined;
}

export function shouldRunDevSubscriber(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    !isOffline() &&
    !env.AGENTMAIL_WEBHOOK_SECRET
  );
}

export async function startDevSubscriber(): Promise<void> {
  if (globalThis.__serverlessBotDevSocket) return;

  const client = getAgentMail();
  const socket = await client.websockets.connect();
  globalThis.__serverlessBotDevSocket = socket;

  let subscribed = new Set<string>();
  const subscribe = async () => {
    try {
      const inboxIds = (await listBots()).map((b) => b.inboxId);
      const next = new Set(inboxIds);
      const changed =
        next.size !== subscribed.size || [...next].some((id) => !subscribed.has(id));
      if (changed && inboxIds.length > 0) {
        socket.sendSubscribe({ type: "subscribe", inboxIds });
        subscribed = next;
      }
    } catch (error) {
      console.warn("[dev-inbound] subscribe failed:", error);
    }
  };

  socket.on("message", (event) => {
    const e = event as unknown as Record<string, unknown>;
    if (e.type === "subscribed") {
      const ids = Array.isArray(e.inboxIds) ? e.inboxIds : [];
      console.log(
        `[dev-inbound] listening for email on ${ids.length} inbox${ids.length === 1 ? "" : "es"} over WebSocket — no webhook or tunnel needed`,
      );
      return;
    }
    if (e.type === "event" && e.eventType === "message.received") {
      const message = e.message as Record<string, unknown> | undefined;
      console.log(`[dev-inbound] ${message?.inboxId} ← ${message?.from}`);
      processInboundEvent({ eventType: "message.received", message })
        .then((r) => {
          if ("summary" in r) console.log(`[dev-inbound] ${r.bot}: ${r.summary.slice(0, 120)}`);
          else if ("skipped" in r) console.log(`[dev-inbound] skipped: ${r.skipped}`);
          else console.warn(`[dev-inbound] ${r.error}`);
        })
        .catch((error) => console.error("[dev-inbound] turn failed:", error));
    }
  });
  socket.on("close", () => {
    console.warn("[dev-inbound] socket closed; reconnecting");
    globalThis.__serverlessBotDevSocket = undefined;
    setTimeout(() => startDevSubscriber().catch(() => {}), 2_000);
  });

  await socket.waitForOpen();
  await subscribe();
  // Pick up bots created after boot.
  setInterval(subscribe, RESUBSCRIBE_MS).unref();
}
