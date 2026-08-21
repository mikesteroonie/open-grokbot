/**
 * Runs once when the server boots. In development, starts the WebSocket
 * inbound-mail subscriber so a fresh clone reacts to email with no
 * webhook, tunnel, or secret. Production relies on the signed webhook.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { shouldRunDevSubscriber, startDevSubscriber } = await import("./lib/dev-subscriber");
  if (!shouldRunDevSubscriber()) return;
  startDevSubscriber().catch((error) => {
    console.warn("[dev-inbound] could not start WebSocket subscriber:", error);
  });
}
