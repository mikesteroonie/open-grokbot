import { NextResponse, after } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import type { UIMessage } from "ai";
import { getBot } from "@/lib/bots";
import { streamChatTurn } from "@/lib/agent";
import { appendChatTurn } from "@/lib/chatlog";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { messages, botId }: { messages: UIMessage[]; botId?: string } =
    await req.json();

  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }
  const bot = await getBot(botId);
  if (!bot) {
    return NextResponse.json({ error: `Unknown bot: ${botId}` }, { status: 404 });
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = (lastUser?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();

  try {
    const result = await streamChatTurn({
      bot,
      messages,
      // Write-behind: persist the turn-pair to the bot's web-chat thread
      // after the response is sent. The stream never waits on email.
      onFinish: (text) => after(() => appendChatTurn(bot, userText, text)),
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    return apiErrorResponse(error);
  }
}
