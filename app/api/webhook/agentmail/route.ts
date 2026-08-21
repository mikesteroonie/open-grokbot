import { NextResponse } from "next/server";
import { getBot, listBots } from "@/lib/bots";
import { getAgentMail } from "@/lib/agentmail";
import { handleInboundEmail } from "@/lib/agent";
import { verifyWebhook } from "@/lib/webhook-verify";
import { env, isOffline } from "@/lib/env";

export const maxDuration = 300;

/**
 * Inbound mail → agent turn.
 *
 * AgentMail POSTs a `message.received` event here whenever any bot inbox
 * gets an email. We verify the signature, resolve which bot owns the
 * inbox, and let that bot's agent loop read the thread and respond.
 *
 * Raw webhook JSON is snake_case; we read both cases defensively.
 */

type RawMessage = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export async function POST(req: Request) {
  const payload = await req.text();

  const secret = env.AGENTMAIL_WEBHOOK_SECRET;
  if (secret) {
    if (!verifyWebhook({ secret, headers: req.headers, payload })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Refuse to process unauthenticated webhooks in production. Anyone who
    // finds the URL could otherwise puppet your bots with forged "emails".
    return NextResponse.json(
      { error: "AGENTMAIL_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = str(event.event_type) ?? str(event.eventType);
  if (eventType !== "message.received") {
    return NextResponse.json({ ok: true, skipped: eventType });
  }

  const message = (event.message ?? {}) as RawMessage;
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
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  const bot = await getBot(inboxId);
  if (!bot) {
    // Mail for an inbox this app doesn't manage — ack so it isn't retried.
    return NextResponse.json({ ok: true, skipped: "unmanaged inbox" });
  }

  // Never respond to our own outbound mail.
  if (from.toLowerCase().includes(bot.email.toLowerCase())) {
    return NextResponse.json({ ok: true, skipped: "self" });
  }

  // Bot-to-bot mail is a feature (contacts let bots delegate to each
  // other), but unbounded it's an infinite reply loop. When the sender is
  // another of our bots, cap the run of consecutive bot-only messages at
  // the tail of the thread.
  const MAX_BOT_RUN = 8;
  if (!isOffline()) {
    const senderEmail = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
    const botEmails = new Set(
      (await listBots()).map((b) => b.email.toLowerCase()),
    );
    if (botEmails.has(senderEmail)) {
      const thread = await getAgentMail().inboxes.threads.get(bot.inboxId, threadId);
      let run = 0;
      for (let i = thread.messages.length - 1; i >= 0; i--) {
        const mFrom = thread.messages[i].from;
        const addr = (mFrom.match(/<([^>]+)>/)?.[1] ?? mFrom).trim().toLowerCase();
        if (!botEmails.has(addr)) break;
        run++;
      }
      if (run >= MAX_BOT_RUN) {
        console.warn(
          `[loop-guard] ${bot.name}: ${run} consecutive bot-to-bot messages in thread ${threadId}; not responding.`,
        );
        return NextResponse.json({ ok: true, skipped: "bot loop guard" });
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

  return NextResponse.json({ ok: true, bot: bot.name, summary });
}
