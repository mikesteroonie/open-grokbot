import { getAgentMail } from "./agentmail";
import { isOffline } from "./env";
import type { Bot } from "./bots";

/**
 * Web chat persisted as an email thread — the thesis completing itself.
 *
 * The chat path never waits on this: turns stream to the browser over
 * HTTP as before, and AFTER the response is done each turn-pair is
 * appended to a self-thread in the bot's inbox (write-behind). The thread
 * is the durable transcript: it survives redeploys and devices, shows up
 * in the Inbox sheet as a readable log, and the bot can recall web
 * conversations over email via get_thread. localStorage stays as the L1
 * cache; this thread is the source of truth.
 *
 * One self-send per turn-pair (both sides in one body) so a chat turn
 * costs one email against quota. The thread and last-message ids live in
 * inbox metadata — the same no-database key-value store as everything
 * else.
 */

const SUBJECT = "Web chat";
const PRINCIPAL_MARK = "[principal]";
const BOT_MARK = "[bot]";
const MAX_HYDRATED_TURNS = 100;

export type ChatLogEntry = { role: "user" | "assistant"; text: string };

function formatTurn(userText: string, assistantText: string): string {
  return `${PRINCIPAL_MARK}\n${userText.trim()}\n\n${BOT_MARK}\n${assistantText.trim()}\n`;
}

function parseBody(body: string): ChatLogEntry[] {
  const entries: ChatLogEntry[] = [];
  let current: ChatLogEntry | null = null;
  for (const line of body.split("\n")) {
    const mark = line.trim();
    if (mark === PRINCIPAL_MARK || mark === BOT_MARK) {
      if (current) entries.push(current);
      current = { role: mark === PRINCIPAL_MARK ? "user" : "assistant", text: "" };
    } else if (current) {
      current.text += (current.text ? "\n" : "") + line;
    }
  }
  if (current) entries.push(current);
  return entries
    .map((e) => ({ ...e, text: e.text.trim() }))
    .filter((e) => e.text);
}

/** Append one settled chat turn to the bot's web-chat thread. Never throws. */
export async function appendChatTurn(
  bot: Bot,
  userText: string,
  assistantText: string,
): Promise<void> {
  if (isOffline() || !userText.trim() || !assistantText.trim()) return;
  try {
    const client = getAgentMail();
    const inbox = await client.inboxes.get(bot.inboxId);
    const meta = (inbox.metadata ?? {}) as Record<string, unknown>;
    const lastMsg =
      typeof meta.webchatLastMsg === "string" ? meta.webchatLastMsg : undefined;
    const text = formatTurn(userText, assistantText);

    const sent = lastMsg
      ? await client.inboxes.messages.reply(bot.inboxId, lastMsg, {
          text,
          replyAll: false,
        })
      : await client.inboxes.messages.send(bot.inboxId, {
          to: [bot.email],
          subject: SUBJECT,
          text,
        });

    await client.inboxes.update(bot.inboxId, {
      metadata: {
        webchatThread: sent.threadId,
        webchatLastMsg: sent.messageId,
      },
    });
  } catch (error) {
    // Persistence is best-effort by design; the chat already streamed.
    console.error(`[chatlog] append failed for ${bot.email}:`, error);
  }
}

/** Read the bot's web-chat thread back as chat entries (oldest first). */
export async function loadChatLog(bot: Bot): Promise<ChatLogEntry[]> {
  if (isOffline()) return [];
  const client = getAgentMail();
  const inbox = await client.inboxes.get(bot.inboxId);
  const meta = (inbox.metadata ?? {}) as Record<string, unknown>;
  const threadId =
    typeof meta.webchatThread === "string" ? meta.webchatThread : undefined;
  if (!threadId) return [];

  const thread = await client.inboxes.threads.get(bot.inboxId, threadId);
  const entries: ChatLogEntry[] = [];
  for (const m of thread.messages ?? []) {
    entries.push(...parseBody(m.extractedText ?? m.text ?? ""));
  }
  return entries.slice(-MAX_HYDRATED_TURNS * 2);
}
