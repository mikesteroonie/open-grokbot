import { tool, type ToolSet } from "ai";
import { z } from "zod";
import Exa from "exa-js";
import { getAgentMail } from "./agentmail";
import { env, isOffline } from "./env";
import type { Bot } from "./bots";

/**
 * The bot's tool surface. Every mail tool goes through the bot's OWN
 * inbox — that's the whole point: identity per bot, not a shared account.
 *
 * Offline mode (no AGENTMAIL_API_KEY): mail tools log and return a
 * simulated result so the app runs with zero secrets.
 */
/** llms.txt fetches are cached briefly so multi-step turns don't refetch. */
const docsCache = new Map<string, { at: number; text: string }>();
const DOCS_TTL_MS = 10 * 60 * 1000;
const DOCS_MAX_CHARS = 48_000;
const RESPONSE_MAX_CHARS = 12_000;

async function fetchDocs(url: string): Promise<string> {
  const hit = docsCache.get(url);
  if (hit && Date.now() - hit.at < DOCS_TTL_MS) return hit.text;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "text/plain, text/markdown, text/*, */*" },
  });
  if (!res.ok) throw new Error(`Docs fetch failed: ${res.status} ${res.statusText}`);
  const text = (await res.text()).slice(0, DOCS_MAX_CHARS);
  docsCache.set(url, { at: Date.now(), text });
  return text;
}

/**
 * Extra tools from the bot's user-configured integrations: paste an
 * llms.txt URL, a base URL, and an API key in the UI, and the bot can read
 * the docs and call the API. Requests are pinned to each integration's
 * origin and the key is injected server-side — the model never sees it.
 */
function integrationTools(bot: Bot): ToolSet {
  if (bot.integrations.length === 0) return {};
  const names = bot.integrations.map((i) => i.name);
  const byName = new Map(bot.integrations.map((i) => [i.name, i]));

  return {
    read_api_docs: tool({
      description: `Read the API documentation (llms.txt) for one of your integrations: ${names.join(", ")}. Always read the docs before your first api_request to an integration in a conversation.`,
      inputSchema: z.object({
        integration: z.enum(names as [string, ...string[]]),
      }),
      execute: async ({ integration }) => {
        const item = byName.get(integration)!;
        try {
          return { ok: true, docs: await fetchDocs(item.docsUrl) };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    }),

    api_request: tool({
      description: `Call the HTTP API of one of your integrations: ${names.join(", ")}. Authentication is added automatically. Paths resolve against the integration's base URL and must stay on it.`,
      inputSchema: z.object({
        integration: z.enum(names as [string, ...string[]]),
        method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
        path: z
          .string()
          .min(1)
          .describe("Path relative to the base URL, e.g. /v1/items?limit=10"),
        body: z
          .string()
          .optional()
          .describe("JSON request body, for POST/PUT/PATCH"),
      }),
      execute: async ({ integration, method, path, body }) => {
        const item = byName.get(integration)!;
        const base = new URL(item.baseUrl);
        let url: URL;
        try {
          url = new URL(path.replace(/^\//, ""), base.href.endsWith("/") ? base.href : `${base.href}/`);
        } catch {
          return { ok: false, error: `Invalid path: ${path}` };
        }
        if (url.origin !== base.origin) {
          return { ok: false, error: `Requests must stay on ${base.origin}` };
        }
        const headers: Record<string, string> = { accept: "application/json" };
        if (body) headers["content-type"] = "application/json";
        if (item.apiKey) {
          headers[item.apiKeyHeader] =
            item.apiKeyHeader.toLowerCase() === "authorization"
              ? `Bearer ${item.apiKey}`
              : item.apiKey;
        }
        try {
          const res = await fetch(url, {
            method,
            headers,
            body: body || undefined,
            signal: AbortSignal.timeout(30_000),
          });
          const text = (await res.text()).slice(0, RESPONSE_MAX_CHARS);
          return { ok: res.ok, status: res.status, body: text };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    }),
  };
}

/**
 * Mail sends can be refused by the bot's sandbox (send allow-list). Return
 * that as data so the model explains the boundary instead of guessing.
 */
async function guardedSend<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const blocked = /not in allow list|blocked/i.test(message);
    return {
      ok: false as const,
      error: message,
      hint: blocked
        ? "That address is outside your sandbox. You can only email your principal and your contacts — ask your principal to add them as a contact."
        : undefined,
    };
  }
}

export function buildTools(bot: Bot) {
  return {
    ...integrationTools(bot),
    send_email: tool({
      description:
        "Send a new email from your own address. Use for first contact with someone (new thread). For replying inside an existing thread, use reply_to_email instead.",
      inputSchema: z.object({
        to: z.array(z.email()).min(1).describe("Recipient email addresses"),
        cc: z.array(z.email()).optional(),
        subject: z.string().min(1),
        body: z.string().min(1).describe("Plain-text email body"),
      }),
      execute: async ({ to, cc, subject, body }) => {
        if (isOffline()) {
          console.log(`[offline] ${bot.name} would send to ${to.join(", ")}: "${subject}"`);
          return { ok: true, offline: true, note: "Offline mode — no mail was actually sent." };
        }
        const client = getAgentMail();
        return guardedSend(async () => {
          const result = await client.inboxes.messages.send(bot.inboxId, {
            to,
            cc,
            subject,
            text: body,
          });
          return { ok: true as const, messageId: result.messageId, threadId: result.threadId };
        });
      },
    }),

    reply_to_email: tool({
      description:
        "Reply to a specific message in one of your email threads. Keeps the conversation in-thread so everyone retains context.",
      inputSchema: z.object({
        messageId: z.string().describe("The messageId of the message to reply to"),
        body: z.string().min(1).describe("Plain-text reply body"),
        replyAll: z
          .boolean()
          .default(true)
          .describe("Reply to all participants (true) or only the sender (false)"),
      }),
      execute: async ({ messageId, body, replyAll }) => {
        if (isOffline()) {
          console.log(`[offline] ${bot.name} would reply to message ${messageId}`);
          return { ok: true, offline: true, note: "Offline mode — no mail was actually sent." };
        }
        const client = getAgentMail();
        return guardedSend(async () => {
          const result = await client.inboxes.messages.reply(bot.inboxId, messageId, {
            text: body,
            replyAll,
          });
          return { ok: true as const, messageId: result.messageId, threadId: result.threadId };
        });
      },
    }),

    list_threads: tool({
      description: "List the most recent threads in your own inbox.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20),
      }),
      execute: async ({ limit }) => {
        if (isOffline()) {
          return { ok: true, offline: true, threads: [], note: "Offline mode — inbox is empty." };
        }
        const client = getAgentMail();
        const page = await client.inboxes.threads.list(bot.inboxId, { limit });
        return {
          ok: true,
          threads: page.threads.map((t) => ({
            threadId: t.threadId,
            subject: t.subject,
            preview: t.preview,
            senders: t.senders,
            recipients: t.recipients,
            messageCount: t.messageCount,
            timestamp: t.timestamp,
            lastMessageId: t.lastMessageId,
          })),
        };
      },
    }),

    get_thread: tool({
      description:
        "Read a full thread from your inbox, including every message. Do this before replying so you have the whole context.",
      inputSchema: z.object({
        threadId: z.string(),
      }),
      execute: async ({ threadId }) => {
        if (isOffline()) {
          return { ok: false, offline: true, error: "Offline mode — no real threads exist." };
        }
        const client = getAgentMail();
        const thread = await client.inboxes.threads.get(bot.inboxId, threadId);
        return {
          ok: true,
          threadId: thread.threadId,
          subject: thread.subject,
          messages: thread.messages.map((m) => ({
            messageId: m.messageId,
            from: m.from,
            to: m.to,
            cc: m.cc,
            timestamp: m.timestamp,
            text: m.extractedText ?? m.text ?? m.preview ?? "",
          })),
        };
      },
    }),

    web_search: tool({
      description:
        "Search the web for current information (people, companies, venues, prices). Returns titles, URLs, and snippets.",
      inputSchema: z.object({
        query: z.string().min(1),
        numResults: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, numResults }) => {
        const apiKey = env.EXA_API_KEY;
        if (!apiKey) {
          return {
            ok: false,
            error: "Web search is not configured (EXA_API_KEY missing). Work from what you know and say so.",
          };
        }
        const exa = new Exa(apiKey);
        const out = await exa.searchAndContents(query, {
          numResults,
          text: { maxCharacters: 800 },
        });
        return {
          ok: true,
          results: out.results.map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.text?.slice(0, 400) ?? "",
          })),
        };
      },
    }),

    notify_principal: tool({
      description:
        "Email your principal (the human you work for) to escalate a decision, report a result, or ask for approval.",
      inputSchema: z.object({
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
      execute: async ({ subject, body }) => {
        const principal = env.PRINCIPAL_EMAIL;
        if (isOffline() || !principal) {
          console.log(`[offline] ${bot.name} would notify principal: "${subject}"`);
          return {
            ok: true,
            offline: true,
            note: principal
              ? "Offline mode — no mail was actually sent."
              : "PRINCIPAL_EMAIL is not set; logged instead of sending.",
          };
        }
        const client = getAgentMail();
        const result = await client.inboxes.messages.send(bot.inboxId, {
          to: [principal],
          subject,
          text: body,
        });
        return { ok: true, messageId: result.messageId };
      },
    }),
  };
}
