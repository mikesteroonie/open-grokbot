import { getAgentMail, getDomain } from "./agentmail";
import { syncInboxAllowlist, syncOrgAllowlist } from "./allowlist";
import { isOffline } from "./env";
import type { BotTemplate } from "./starter-bots";
import {
  normalizeColor,
  normalizeShape,
  type AvatarColorId,
  type AvatarShapeId,
} from "./avatars";

export type Integration = {
  /** Short handle the model uses to pick this API, e.g. "stripe". */
  name: string;
  /** Root URL API paths resolve against. Requests may not leave this origin. */
  baseUrl: string;
  /** llms.txt or other plain-text API docs the bot reads before calling. */
  docsUrl: string;
  /** Secret, stored in inbox metadata. Never sent to the browser. */
  apiKey: string;
  /** Header the key goes in. Default Authorization (as a Bearer token). */
  apiKeyHeader: string;
};

export type Contact = {
  name: string;
  email: string;
  /** What this contact does — included in the bot's system prompt. */
  description: string;
};

export type Bot = {
  /** Stable id — the AgentMail inbox id (which is the email address). */
  id: string;
  name: string;
  tagline: string;
  personality: string;
  contacts: Contact[];
  integrations: Integration[];
  color: AvatarColorId;
  shape: AvatarShapeId;
  email: string;
  inboxId: string;
  createdAt: string;
};

const APP_TAG = "serverless-bot";
/** Earlier releases stamped inboxes with the project's old name. */
const APP_TAGS = new Set([APP_TAG, "open-grokbot"]);

/**
 * Inbox metadata string values cap at 256 chars, so long values (the
 * personality prompt, the contacts JSON) are chunked across numbered keys
 * (personality0…n, contacts0…n).
 */
const CHUNK = 250;
const MAX_PERSONALITY = 4000;
const MAX_CONTACTS = 24;
const MAX_INTEGRATIONS = 6;

function chunkToMeta(prefix: string, text: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (let i = 0; i * CHUNK < text.length; i++) {
    meta[`${prefix}${i}`] = text.slice(i * CHUNK, (i + 1) * CHUNK);
  }
  return meta;
}

function chunkFromMeta(prefix: string, meta: Record<string, unknown>): string {
  const parts: string[] = [];
  for (let i = 0; ; i++) {
    const part = meta[`${prefix}${i}`];
    if (typeof part !== "string") break;
    parts.push(part);
  }
  return parts.join("");
}

function personalityToMeta(personality: string): Record<string, string> {
  return chunkToMeta("personality", personality.slice(0, MAX_PERSONALITY));
}

export function sanitizeContacts(input: unknown): Contact[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (c): c is Record<string, unknown> => typeof c === "object" && c !== null,
    )
    .map((c) => ({
      name: String(c.name ?? "").slice(0, 60),
      email: String(c.email ?? "").slice(0, 254),
      description: String(c.description ?? "").slice(0, 300),
    }))
    .filter((c) => c.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
    .slice(0, MAX_CONTACTS);
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizeIntegrations(input: unknown): Integration[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (i): i is Record<string, unknown> => typeof i === "object" && i !== null,
    )
    .map((i) => ({
      name: String(i.name ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "")
        .slice(0, 40),
      baseUrl: String(i.baseUrl ?? "").slice(0, 300),
      docsUrl: String(i.docsUrl ?? "").slice(0, 300),
      apiKey: String(i.apiKey ?? "").slice(0, 300),
      apiKeyHeader: String(i.apiKeyHeader ?? "Authorization").slice(0, 60) || "Authorization",
    }))
    .filter((i) => i.name && isHttpUrl(i.baseUrl) && isHttpUrl(i.docsUrl))
    .slice(0, MAX_INTEGRATIONS);
}

function integrationsFromMeta(meta: Record<string, unknown>): Integration[] {
  const raw = chunkFromMeta("integrations", meta);
  if (!raw) return [];
  try {
    return sanitizeIntegrations(JSON.parse(raw));
  } catch {
    return [];
  }
}

function contactsFromMeta(meta: Record<string, unknown>): Contact[] {
  const raw = chunkFromMeta("contacts", meta);
  if (!raw) return [];
  try {
    return sanitizeContacts(JSON.parse(raw));
  } catch {
    return [];
  }
}

function inboxToBot(inbox: {
  inboxId: string;
  email?: string;
  displayName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date | string;
}): Bot | null {
  const meta = inbox.metadata ?? {};
  if (!APP_TAGS.has(String(meta.app))) return null;
  const email = inbox.email ?? inbox.inboxId;
  return {
    id: inbox.inboxId,
    name: inbox.displayName ?? String(meta.name ?? email.split("@")[0]),
    tagline: typeof meta.tagline === "string" ? meta.tagline : "",
    personality: chunkFromMeta("personality", meta),
    contacts: contactsFromMeta(meta),
    integrations: integrationsFromMeta(meta),
    color: normalizeColor(meta.avatarColor),
    shape: normalizeShape(meta.avatarShape),
    email,
    inboxId: inbox.inboxId,
    createdAt: new Date(inbox.createdAt).toISOString(),
  };
}

/* ------------------------------------------------------------------- */
/* Offline mode: in-memory roster so `pnpm dev` works with no secrets.  */
/* Starts empty — same first-run experience as a real deployment.       */
/* ------------------------------------------------------------------- */

const offlineBots = new Map<string, Bot>();

/* ------------------------------------------------------------------- */
/* Registry API — AgentMail is the only persistence layer.              */
/* ------------------------------------------------------------------- */

export async function listBots(): Promise<Bot[]> {
  if (isOffline()) {
    return [...offlineBots.values()];
  }
  const client = getAgentMail();
  const bots: Bot[] = [];
  let pageToken: string | undefined;
  do {
    const page = await client.inboxes.list({ limit: 100, pageToken });
    for (const inbox of page.inboxes) {
      const bot = inboxToBot(inbox);
      if (bot) bots.push(bot);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return bots.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getBot(id: string): Promise<Bot | null> {
  if (isOffline()) {
    return offlineBots.get(id) ?? null;
  }
  const client = getAgentMail();
  try {
    const inbox = await client.inboxes.get(id);
    return inboxToBot(inbox);
  } catch {
    return null;
  }
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bot"
  );
}

export async function createBot(input: {
  name: string;
  /** Optional explicit email username; defaults to a slug of the name. */
  username?: string;
  tagline?: string;
  personality: string;
  color?: string;
  shape?: string;
}): Promise<Bot> {
  const username = input.username?.trim() || slugify(input.name);
  const tagline = (input.tagline ?? "").slice(0, 200);
  const color = normalizeColor(input.color);
  const shape = normalizeShape(input.shape);

  if (isOffline()) {
    const email = `${username}@offline.local`;
    const bot: Bot = {
      id: email,
      name: input.name,
      tagline,
      personality: input.personality,
      contacts: [],
      integrations: [],
      color,
      shape,
      email,
      inboxId: email,
      createdAt: new Date().toISOString(),
    };
    offlineBots.set(email, bot);
    console.log(`[offline] registered bot "${input.name}" <${email}> (no real inbox)`);
    return bot;
  }

  const client = getAgentMail();
  const domain = getDomain();

  // clientId makes provisioning idempotent: re-creating the same bot name
  // returns the existing inbox instead of minting a duplicate.
  const inbox = await client.inboxes.create({
    username,
    domain,
    displayName: input.name,
    clientId: `${APP_TAG}-${username}`,
    metadata: {
      app: APP_TAG,
      name: input.name,
      tagline,
      avatarColor: color,
      avatarShape: shape,
      ...personalityToMeta(input.personality),
    },
  });

  const bot = inboxToBot(inbox);
  if (!bot) throw new Error("Provisioned inbox came back without app metadata");

  // Sandbox from the first second. Org scope: principal + the whole
  // roster (including this new bot), written once. Inbox scope: this
  // bot's contacts. The roster is re-listed here because the org list is
  // the one place every bot must appear.
  const roster = await listBots();
  const rosterEmails = new Set(roster.map((b) => b.email));
  rosterEmails.add(bot.email);
  await syncOrgAllowlist([...rosterEmails]);
  await syncInboxAllowlist(bot.inboxId, bot.contacts);
  return bot;
}

/**
 * Replace a bot's contact list. Contacts live in inbox metadata as chunked
 * JSON; stale chunk keys beyond the new count are removed via null values
 * (AgentMail merges metadata on update).
 */
export async function setContacts(
  botId: string,
  contacts: Contact[],
): Promise<Bot> {
  const clean = sanitizeContacts(contacts);

  if (isOffline()) {
    const bot = offlineBots.get(botId);
    if (!bot) throw new Error(`Unknown bot: ${botId}`);
    const updated = { ...bot, contacts: clean };
    offlineBots.set(botId, updated);
    return updated;
  }

  const client = getAgentMail();
  const current = await client.inboxes.get(botId);
  const currentMeta = (current.metadata ?? {}) as Record<string, unknown>;
  if (!APP_TAGS.has(String(currentMeta.app))) throw new Error(`Unknown bot: ${botId}`);

  const newChunks = chunkToMeta("contacts", JSON.stringify(clean));
  const removals: Record<string, null> = {};
  for (let i = 0; `contacts${i}` in currentMeta; i++) {
    if (!(`contacts${i}` in newChunks)) removals[`contacts${i}`] = null;
  }

  const inbox = await client.inboxes.update(botId, {
    metadata: { ...newChunks, ...removals },
  });
  const bot = inboxToBot(inbox);
  if (!bot) throw new Error("Updated inbox came back without app metadata");

  // Contacts are the per-bot sandbox boundary (the principal and fellow
  // bots are allowed org-wide).
  await syncInboxAllowlist(bot.inboxId, bot.contacts);
  return bot;
}

/**
 * Replace a bot's integration list. Same chunked-metadata scheme as
 * contacts. An incoming entry with an empty apiKey inherits the stored key
 * of the same-named integration — the browser only ever sees masked keys,
 * so "unchanged" round-trips as empty.
 */
export async function setIntegrations(
  botId: string,
  integrations: Integration[],
): Promise<Bot> {
  const current = await getBot(botId);
  if (!current) throw new Error(`Unknown bot: ${botId}`);

  const clean = sanitizeIntegrations(integrations).map((i) => {
    if (i.apiKey) return i;
    const existing = current.integrations.find((e) => e.name === i.name);
    return existing ? { ...i, apiKey: existing.apiKey } : i;
  });

  if (isOffline()) {
    const updated = { ...current, integrations: clean };
    offlineBots.set(botId, updated);
    return updated;
  }

  const client = getAgentMail();
  const raw = await client.inboxes.get(botId);
  const currentMeta = (raw.metadata ?? {}) as Record<string, unknown>;
  if (!APP_TAGS.has(String(currentMeta.app))) throw new Error(`Unknown bot: ${botId}`);

  const newChunks = chunkToMeta("integrations", JSON.stringify(clean));
  const removals: Record<string, null> = {};
  for (let i = 0; `integrations${i}` in currentMeta; i++) {
    if (!(`integrations${i}` in newChunks)) removals[`integrations${i}`] = null;
  }

  const inbox = await client.inboxes.update(botId, {
    metadata: { ...newChunks, ...removals },
  });
  const bot = inboxToBot(inbox);
  if (!bot) throw new Error("Updated inbox came back without app metadata");
  return bot;
}

/** Mask a stored API key for display: never ship the real value to the browser. */
export function maskApiKey(key: string): string {
  if (!key) return "";
  return `••••${key.slice(-4)}`;
}

/**
 * What the browser is allowed to see. Identical to Bot except integration
 * API keys are masked.
 */
export function botToDto(bot: Bot): Omit<Bot, "integrations"> & {
  integrations: Array<Omit<Integration, "apiKey"> & { apiKeyMasked: string }>;
} {
  return {
    ...bot,
    integrations: bot.integrations.map(({ apiKey, ...rest }) => ({
      ...rest,
      apiKeyMasked: maskApiKey(apiKey),
    })),
  };
}

export type { BotTemplate };
