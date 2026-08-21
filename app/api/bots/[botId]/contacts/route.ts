import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { getBot, setContacts } from "@/lib/bots";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const bot = await getBot(botId);
  if (!bot) {
    return NextResponse.json({ error: `Unknown bot: ${botId}` }, { status: 404 });
  }
  return NextResponse.json({ contacts: bot.contacts });
}

const ContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        email: z.email().max(254),
        description: z.string().max(300).default(""),
      }),
    )
    .max(24),
});

/** Replaces the bot's full contact list. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  let input: z.infer<typeof ContactsSchema>;
  try {
    input = ContactsSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid contact list" }, { status: 400 });
  }

  try {
    const bot = await setContacts(botId, input.contacts);
    return NextResponse.json({ contacts: bot.contacts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiErrorResponse(error, message.startsWith("Unknown bot") ? 404 : 500);
  }
}
