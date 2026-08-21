import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getBot } from "@/lib/bots";
import { loadChatLog } from "@/lib/chatlog";

/** Hydration source for the web chat: the bot's chat-log email thread. */
export async function GET(req: Request) {
  const botId = new URL(req.url).searchParams.get("botId");
  if (!botId) {
    return NextResponse.json({ error: "botId is required" }, { status: 400 });
  }
  const bot = await getBot(botId);
  if (!bot) {
    return NextResponse.json({ error: `Unknown bot: ${botId}` }, { status: 404 });
  }
  try {
    return NextResponse.json({ entries: await loadChatLog(bot) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
