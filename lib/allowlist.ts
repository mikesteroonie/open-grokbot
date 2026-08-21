import { getAgentMail } from "./agentmail";
import { env } from "./env";
import type { Contact } from "./bots";

/**
 * The sandbox, enforced at the mail layer in every direction — receive,
 * reply, and send — so nobody can email a bot and a bot can't email
 * anybody, except a closed set. AgentMail evaluates lists inbox → pod →
 * org, most specific match wins, and an allow list is deny-by-default, so
 * there is no block list to maintain.
 *
 * Two scopes, no duplication:
 *
 *   org   — the human principal and every bot on the roster. Shared by
 *           all inboxes, written once. Bots can always reach each other.
 *   inbox — that bot's contacts only. A bot's world is its contact sheet.
 *
 * Consequence: the whole AgentMail org is sealed. Any inbox in it that
 * this app doesn't own goes deny-by-default too — run the bots in a
 * dedicated org.
 */
const DIRECTIONS = ["receive", "reply", "send"] as const;
type Direction = (typeof DIRECTIONS)[number];

type ListOps = {
  list: (direction: Direction, pageToken?: string) => Promise<{
    entries?: Array<{ entry: string }>;
    nextPageToken?: string;
  }>;
  create: (direction: Direction, entry: string) => Promise<unknown>;
  remove: (direction: Direction, entry: string) => Promise<unknown>;
};

function orgOps(): ListOps {
  const client = getAgentMail();
  return {
    list: (d, pageToken) => client.lists.list(d, "allow", { limit: 100, pageToken }),
    create: (d, entry) => client.lists.create(d, "allow", { entry }),
    remove: (d, entry) => client.lists.delete(d, "allow", entry),
  };
}

function inboxOps(inboxId: string): ListOps {
  const client = getAgentMail();
  return {
    list: (d, pageToken) =>
      client.inboxes.lists.list(inboxId, d, "allow", { limit: 100, pageToken }),
    create: (d, entry) => client.inboxes.lists.create(inboxId, d, "allow", { entry }),
    remove: (d, entry) => client.inboxes.lists.delete(inboxId, d, "allow", entry),
  };
}

async function currentEntries(ops: ListOps, direction: Direction): Promise<Set<string>> {
  const current = new Set<string>();
  let pageToken: string | undefined;
  do {
    const page = await ops.list(direction, pageToken);
    for (const e of page.entries ?? []) current.add(e.entry.toLowerCase());
    pageToken = page.nextPageToken;
  } while (pageToken);
  return current;
}

async function reconcile(
  ops: ListOps,
  desired: Set<string>,
  { prune }: { prune: boolean },
): Promise<void> {
  for (const direction of DIRECTIONS) {
    const current = await currentEntries(ops, direction);
    for (const entry of desired) {
      if (!current.has(entry)) await ops.create(direction, entry);
    }
    if (prune) {
      for (const entry of current) {
        if (!desired.has(entry)) await ops.remove(direction, entry);
      }
    }
  }
}

/**
 * Org scope: principal + every bot. Additive only — the org list may hold
 * entries an operator added by hand, and we don't own those.
 */
export async function syncOrgAllowlist(botEmails: string[]): Promise<void> {
  const desired = new Set<string>(botEmails.map((e) => e.toLowerCase()));
  const principal = env.PRINCIPAL_EMAIL?.trim().toLowerCase();
  if (principal) desired.add(principal);
  if (desired.size === 0) return;
  await reconcile(orgOps(), desired, { prune: false });
}

/**
 * Inbox scope: this bot's contacts, exactly. The contact sheet is the
 * source of truth, so entries that no longer match a contact are removed.
 */
export async function syncInboxAllowlist(
  inboxId: string,
  contacts: Contact[],
): Promise<void> {
  const desired = new Set(contacts.map((c) => c.email.trim().toLowerCase()));
  await reconcile(inboxOps(inboxId), desired, { prune: true });
}
