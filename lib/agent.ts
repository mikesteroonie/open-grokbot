import {
  convertToModelMessages,
  generateText,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import type { Bot } from "./bots";
import { buildTools } from "./tools";
import { getModel } from "./model";
import { env, isOffline } from "./env";

function systemPrompt(bot: Bot): string {
  const principal = env.PRINCIPAL_EMAIL;
  const contacts =
    bot.contacts.length > 0
      ? `\nYour contacts — people and fellow bots you can email directly:\n${bot.contacts
          .map((c) => `- ${c.name} <${c.email}>${c.description ? ` — ${c.description}` : ""}`)
          .join("\n")}\n
Coordination rules for contacts:
- When part of a task belongs to a contact's specialty, delegate it: email them a clear, self-contained brief (goal, constraints, deadline, what to report back).
- Coordinate in as few emails as possible. Never reply just to acknowledge; reply when you have information or a decision.
- If a contact loops you into a thread, read the whole thread before acting, do your part, and report back in-thread.\n`
      : "";
  const integrations =
    bot.integrations.length > 0
      ? `\nYour API integrations (use read_api_docs first, then api_request):\n${bot.integrations
          .map((i) => `- ${i.name} — base ${i.baseUrl}`)
          .join("\n")}\n`
      : "";
  return `${bot.personality}
${contacts}${integrations}
How you are built (so you can explain yourself when asked, e.g. "how are you different from Grok Bot?"):
- You are serverless and event-driven. You do not have a computer, a VM, a browser, or a filesystem, and nothing about you is running between turns. You wake up when an email arrives or your principal messages you, do the work, and stop. At rest you are pure data.
- Your inbox is your identity, your trigger, and your memory. Your email address is who you are; an inbound email is what wakes you; the thread is what you remember. There is no database behind you — your personality and contacts live in your inbox's metadata, and your web chats are stored as an email thread too.
- Grok Bot and most of its clones give each bot (or each user) a persistent cloud computer with logged-in browser sessions. You act only through typed API calls — email, web search, and any API your principal wires in — so there are no sessions to hijack and no machine billing while you idle.
- You are sandboxed at the mail layer: you can only correspond with your principal, your contacts, and your fellow bots. Strangers cannot email you, and you cannot email anyone you were not introduced to.
- Computer use (driving a UI) is what other bots fall back to for software with no API; you don't do it. If a task truly needs it, say so and escalate.

Operational facts:
- Your name is ${bot.name}. Your email address is ${bot.email}. Mail you send comes from this address.
- Today's date is ${new Date().toDateString()}.
${principal ? `- Your principal's email address is ${principal}.` : "- No principal email is configured yet."}
${isOffline() ? "- You are running OFFLINE: mail tools simulate sends and your inbox is empty. Be upfront about this when asked to send real mail." : ""}

Tool discipline:
- Read a thread (get_thread) before replying to it.
- One email per intent — don't send three messages where one would do.
- After you finish a multi-step job, summarize what you did and what happens next.`;
}

/** Chat turn initiated by the principal in the web UI. Streams. */
export async function streamChatTurn({
  bot,
  messages,
  onFinish,
}: {
  bot: Bot;
  messages: UIMessage[];
  /** Called with the final assistant text once the stream settles. */
  onFinish?: (text: string) => void;
}) {
  return streamText({
    model: getModel(),
    system: systemPrompt(bot),
    messages: await convertToModelMessages(messages),
    tools: buildTools(bot),
    stopWhen: stepCountIs(12),
    onFinish: ({ text }) => onFinish?.(text),
  });
}

export type InboundEmail = {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  cc?: string[];
  subject?: string;
  text: string;
};

/**
 * Agent turn triggered by an inbound email (webhook). The bot reads the
 * thread, decides, and acts — usually by replying in-thread.
 */
export async function handleInboundEmail({
  bot,
  email,
}: {
  bot: Bot;
  email: InboundEmail;
}) {
  const result = await generateText({
    model: getModel(),
    system: systemPrompt(bot),
    prompt: `A new email just arrived in your inbox.

From: ${email.from}
To: ${email.to.join(", ")}${email.cc?.length ? `\nCc: ${email.cc.join(", ")}` : ""}
Subject: ${email.subject ?? "(no subject)"}
Thread ID: ${email.threadId}
Message ID: ${email.messageId}

Body:
${email.text}

Handle it. Read the full thread first (get_thread with the thread ID above) so you have complete context, then take the right action — usually reply_to_email on the message ID above. If the email needs your principal's input, use notify_principal. If it's spam or clearly needs no response, do nothing and say so.`,
    tools: buildTools(bot),
    stopWhen: stepCountIs(12),
  });
  return result.text;
}
