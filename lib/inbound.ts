import { getBot, listBots } from "./bots";
import { getAgentMail } from "./agentmail";
import { handleInboundEmail } from "./agent";
import { isOffline } from "./env";

/**
 * Inbound mail → agent turn. One handler, two transports:
 *
 *   production  — AgentMail POSTs a signed `message.received` webhook
 *                 (app/api/webhook/agentmail)
 *   development — the dev server subscribes to AgentMail's WebSocket event
 *                 stream, so a fresh clone reacts to email with no tunnel,
 *                 no dashboard, no secret (lib/dev-subscriber)
 *
 * Event payloads are snake_case over the webhook and camelCase over the
 * SDK socket; both are read defensively.
 */

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** "Name <addr>" or bare addr → lowercase addr. */
function address(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
}

const MAX_BOT_RUN = 8;

export type InboundResult =
  | { ok: true; skipped: string }
  | { ok: true; bot: string; summary: string }
  | { ok: false; error: string };

export async function processInboundEvent(event: Raw): Promise<InboundResult> {
  const eventType = str(event.event_type) ?? str(event.eventType);
  if (eventType !== "message.received") {
    return { ok: true, skipped: eventType ?? "unknown event" };
  }

  const message = (event.message ?? {}) as Raw;
  const inboxId = str(message.inbox_id) ?? str(message.inboxId);
  const messageId = str(message.message_id) ?? str(message.messageId);
  const threadId = str(message.thread_id) ?? str(message.threadId);
  const from = str(message.from) ?? "";
  const text =
    str(message.extracted_text) ??
    str(message.extractedText) ??
    str(message.text) ??
    str(message.preview) ??
    "";

  if (!inboxId || !messageId || !threadId) {
    return { ok: false, error: "Malformed event" };
  }

  const bot = await getBot(inboxId);
  if (!bot) return { ok: true, skipped: "unmanaged inbox" };

  // Never respond to our own outbound mail (incl. the web-chat log).
  if (address(from) === bot.email.toLowerCase()) {
    return { ok: true, skipped: "self" };
  }

  // Bot-to-bot mail is a feature (contacts let bots delegate to each
  // other), but unbounded it's an infinite reply loop. When the sender is
  // another of our bots, cap the run of consecutive bot-only messages at
  // the tail of the thread.
  if (!isOffline()) {
    const botEmails = new Set((await listBots()).map((b) => b.email.toLowerCase()));
    if (botEmails.has(address(from))) {
      const thread = await getAgentMail().inboxes.threads.get(bot.inboxId, threadId);
      let run = 0;
      for (let i = thread.messages.length - 1; i >= 0; i--) {
        if (!botEmails.has(address(thread.messages[i].from))) break;
        run++;
      }
      if (run >= MAX_BOT_RUN) {
        console.warn(
          `[loop-guard] ${bot.name}: ${run} consecutive bot-to-bot messages in thread ${threadId}; not responding.`,
        );
        return { ok: true, skipped: "bot loop guard" };
      }
    }
  }

  const summary = await handleInboundEmail({
    bot,
    email: {
      messageId,
      threadId,
      from,
      to: strArray(message.to),
      cc: strArray(message.cc),
      subject: str(message.subject),
      text,
    },
  });
  return { ok: true, bot: bot.name, summary };
}
