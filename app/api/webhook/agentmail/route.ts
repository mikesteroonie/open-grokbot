import { NextResponse } from "next/server";
import { verifyWebhook } from "@/lib/webhook-verify";
import { processInboundEvent } from "@/lib/inbound";
import { env } from "@/lib/env";

export const maxDuration = 300;

/**
 * Production inbound mail: AgentMail POSTs a signed `message.received`
 * event here. Register the webhook with `pnpm webhook <public-url>`; the
 * handler itself lives in lib/inbound.ts and is shared with the dev
 * WebSocket subscriber.
 */
export async function POST(req: Request) {
  const payload = await req.text();

  const secret = env.AGENTMAIL_WEBHOOK_SECRET;
  if (secret) {
    if (!verifyWebhook({ secret, headers: req.headers, payload })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Refuse unauthenticated webhooks in production. Anyone who found the
    // URL could otherwise puppet your bots with forged "emails".
    return NextResponse.json(
      { error: "AGENTMAIL_WEBHOOK_SECRET is not configured" },
      { status: 503 },
    );
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = await processInboundEvent(event);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
