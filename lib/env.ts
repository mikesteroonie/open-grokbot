/**
 * Env vars are read through getters at call time (not captured at module
 * load) so `next dev`'s .env.local hot-reload is observable from server
 * code without a full process restart.
 */
export const env = {
  get AGENTMAIL_API_KEY() {
    return process.env.AGENTMAIL_API_KEY;
  },
  get AGENTMAIL_DOMAIN() {
    return process.env.AGENTMAIL_DOMAIN;
  },
  get AGENTMAIL_WEBHOOK_SECRET() {
    return process.env.AGENTMAIL_WEBHOOK_SECRET;
  },
  get AI_MODEL_ID() {
    return process.env.AI_MODEL_ID;
  },
  get XAI_API_KEY() {
    return process.env.XAI_API_KEY;
  },
  get EXA_API_KEY() {
    return process.env.EXA_API_KEY;
  },
  get PRINCIPAL_EMAIL() {
    return process.env.PRINCIPAL_EMAIL;
  },
};

export function requireEnv(key: keyof typeof env): string {
  const value = env[key];
  if (!value) {
    throw new Error(
      `Missing required env var: ${key}. Add it to .env.local (see .env.example) and restart the dev server.`,
    );
  }
  return value;
}

/**
 * Offline mode = no AgentMail key. Bots live in memory, mail tools log
 * instead of sending, and `pnpm dev` works with zero secrets.
 */
export function isOffline(): boolean {
  return !env.AGENTMAIL_API_KEY;
}
