import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getAgentMail } from "@/lib/agentmail";
import { getBot } from "@/lib/bots";
import { isOffline } from "@/lib/env";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const botId = new URL(req.url).searchParams.get("botId");
  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }
  const bot = await getBot(botId);
  if (!bot) {
    return NextResponse.json({ error: `Unknown bot: ${botId}` }, { status: 404 });
  }
  if (isOffline()) {
    return NextResponse.json({ error: "No real threads in offline mode" }, { status: 404 });
  }

  try {
    const client = getAgentMail();
    const thread = await client.inboxes.threads.get(bot.inboxId, threadId);
    return NextResponse.json({
      thread: {
        threadId: thread.threadId,
        subject: thread.subject,
        messages: thread.messages.map((m) => ({
          messageId: m.messageId,
          from: m.from,
          to: m.to,
          cc: m.cc,
          subject: m.subject,
          timestamp: m.timestamp,
          text: m.extractedText ?? m.text ?? "",
        })),
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
