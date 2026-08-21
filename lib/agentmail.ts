import { AgentMailClient } from "agentmail";
import { env, requireEnv } from "./env";

let client: AgentMailClient | null = null;
let clientKey: string | null = null;

export function getAgentMail(): AgentMailClient {
  const apiKey = requireEnv("AGENTMAIL_API_KEY");
  if (clientKey !== apiKey) {
    client = new AgentMailClient({ apiKey });
    clientKey = apiKey;
  }
  return client!;
}

export const DEFAULT_DOMAIN = "agentmail.to";

export function getDomain(): string {
  return env.AGENTMAIL_DOMAIN || DEFAULT_DOMAIN;
}
