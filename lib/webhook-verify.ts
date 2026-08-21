import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify an AgentMail webhook (Svix-style signature scheme).
 *
 * Headers: svix-id, svix-timestamp, svix-signature.
 * Secret: the `whsec_…` value returned when the webhook was created.
 * Signed content: `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 with the
 * base64-decoded secret; the header holds space-separated `v1,<base64>`
 * candidates.
 */
export function verifyWebhook({
  secret,
  headers,
  payload,
}: {
  secret: string;
  headers: Headers;
  payload: string;
}): boolean {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const now = Math.floor(Date.now() / 1000);
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest();

  for (const candidate of signatureHeader.split(" ")) {
    const [version, sig] = candidate.split(",", 2);
    if (version !== "v1" || !sig) continue;
    const provided = Buffer.from(sig, "base64");
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return true;
    }
  }
  return false;
}
