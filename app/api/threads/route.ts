import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getAgentMail } from "@/lib/agentmail";
import { getBot } from "@/lib/bots";
import { isOffline } from "@/lib/env";

export async function GET(req: Request) {
  const botId = new URL(req.url).searchParams.get("botId");
  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }
  const bot = await getBot(botId);
  if (!bot) {
    return NextResponse.json({ error: `Unknown bot: ${botId}` }, { status: 404 });
  }

  if (isOffline()) {
    return NextResponse.json({ email: bot.email, threads: [], offline: true });
  }

  try {
    const client = getAgentMail();
    const page = await client.inboxes.threads.list(bot.inboxId, { limit: 50 });
    return NextResponse.json({
      email: bot.email,
      threads: page.threads.map((t) => ({
        threadId: t.threadId,
        subject: t.subject,
        preview: t.preview,
        senders: t.senders,
        recipients: t.recipients,
        messageCount: t.messageCount,
        timestamp: t.timestamp,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
