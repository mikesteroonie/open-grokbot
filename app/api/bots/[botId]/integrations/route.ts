import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { z } from "zod";
import { botToDto, getBot, setIntegrations } from "@/lib/bots";
import { env } from "@/lib/env";

/** The bot's always-on tools, with whether each is configured. */
function builtin(email: string) {
  return {
    email,
    webSearch: Boolean(env.EXA_API_KEY),
    principal: env.PRINCIPAL_EMAIL ?? null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const bot = await getBot(botId);
  if (!bot) {
    return NextResponse.json({ error: `Unknown bot: ${botId}` }, { status: 404 });
  }
  return NextResponse.json({
    integrations: botToDto(bot).integrations,
    builtin: builtin(bot.email),
  });
}

const IntegrationsSchema = z.object({
  integrations: z
    .array(
      z.object({
        name: z
          .string()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9_-]+$/, "Name must be a lowercase handle (a-z, 0-9, - and _)"),
        baseUrl: z.url().max(300),
        docsUrl: z.url().max(300),
        // Empty string = keep the key already stored for this name.
        apiKey: z.string().max(300).default(""),
        apiKeyHeader: z.string().max(60).default("Authorization"),
      }),
    )
    .max(6),
});

/** Replaces the bot's full integration list. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ botId: string }> },
) {
  const { botId } = await params;
  const parsed = IntegrationsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid integration list", fix: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  try {
    const bot = await setIntegrations(botId, parsed.data.integrations);
    return NextResponse.json({ integrations: botToDto(bot).integrations });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiErrorResponse(error, message.startsWith("Unknown bot") ? 404 : 500);
  }
}
