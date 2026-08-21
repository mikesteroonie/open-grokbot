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
