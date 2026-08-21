#!/usr/bin/env node
/**
 * Register this deployment's inbound-mail webhook with AgentMail and save
 * the signing secret.
 *
 *   pnpm webhook https://your-app.example.com
 *
 * Idempotent: re-running with the same URL reuses the existing webhook.
 * The secret is only revealed at creation, so it's written to .env.local;
 * for a hosted deploy, copy it into AGENTMAIL_WEBHOOK_SECRET there.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { AgentMailClient } from "agentmail";

const ENV_FILE = ".env.local";
const CLIENT_ID = "serverless-bot-inbound";

function loadEnv() {
  if (!existsSync(ENV_FILE)) return {};
  return Object.fromEntries(
    readFileSync(ENV_FILE, "utf8")
      .split("\n")
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
}

const base = process.argv[2]?.replace(/\/+$/, "");
if (!base || !/^https?:\/\//.test(base)) {
  console.error("usage: pnpm webhook <public base url>   e.g. pnpm webhook https://my-app.vercel.app");
  process.exit(1);
}
const envFile = loadEnv();
const apiKey = process.env.AGENTMAIL_API_KEY || envFile.AGENTMAIL_API_KEY;
if (!apiKey) {
  console.error("AGENTMAIL_API_KEY is not set (env or .env.local)");
  process.exit(1);
}

const client = new AgentMailClient({ apiKey });
const url = `${base}/api/webhook/agentmail`;

const existing = (await client.webhooks.list()).webhooks?.find(
  (w) => w.clientId === CLIENT_ID || w.url === url,
);
if (existing) {
  if (existing.url !== url) {
    await client.webhooks.delete(existing.webhookId);
    console.log(`Replaced webhook that pointed at ${existing.url}`);
  } else {
    console.log(`Webhook already registered for ${url}`);
    console.log("(Its secret was shown at creation; if you lost it, delete the webhook in the AgentMail dashboard and re-run.)");
    process.exit(0);
  }
}

const hook = await client.webhooks.create({
  url,
  eventTypes: ["message.received"],
  clientId: CLIENT_ID,
});
console.log(`Registered ${url}`);

let contents = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
if (/^#?\s*AGENTMAIL_WEBHOOK_SECRET=.*$/m.test(contents)) {
  contents = contents.replace(/^#?\s*AGENTMAIL_WEBHOOK_SECRET=.*$/m, `AGENTMAIL_WEBHOOK_SECRET=${hook.secret}`);
} else {
  contents += `${contents.endsWith("\n") || !contents ? "" : "\n"}AGENTMAIL_WEBHOOK_SECRET=${hook.secret}\n`;
}
writeFileSync(ENV_FILE, contents);
console.log(`Saved AGENTMAIL_WEBHOOK_SECRET to ${ENV_FILE}.`);
console.log("Deploying elsewhere? Set this on the host:");
console.log(`  AGENTMAIL_WEBHOOK_SECRET=${hook.secret}`);
