import { NextResponse } from "next/server";
import { z } from "zod";
import { botToDto, createBot, listBots } from "@/lib/bots";
import { STARTER_BOTS } from "@/lib/starter-bots";
import { env, isOffline } from "@/lib/env";
import { apiErrorResponse } from "@/lib/api-error";
import { getDomain } from "@/lib/agentmail";

export async function GET() {
  try {
    const bots = (await listBots()).map(botToDto);
    const principalLocal = env.PRINCIPAL_EMAIL?.split("@")[0] ?? null;
    return NextResponse.json({
      bots,
      templates: STARTER_BOTS,
      offline: isOffline(),
      principal: principalLocal,
      domain: isOffline() ? "offline.local" : getDomain(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const CreateBotSchema = z.object({
  name: z.string().min(1).max(60),
  username: z
    .string()
    .regex(/^[a-z0-9][a-z0-9._-]{0,39}$/, "Username may only contain lowercase letters, numbers, dots, dashes and underscores")
    .optional(),
  tagline: z.string().max(200).optional(),
  personality: z.string().min(1).max(4000),
  color: z.string().max(20).optional(),
  shape: z.string().max(20).optional(),
});

export async function POST(req: Request) {
  let input: z.infer<typeof CreateBotSchema>;
  try {
    input = CreateBotSchema.parse(await req.json());
  } catch (error) {
    const detail = error instanceof z.ZodError ? error.issues[0]?.message : undefined;
    return NextResponse.json(
      { error: "Invalid bot definition", fix: detail },
      { status: 400 },
    );
  }

  try {
    const bot = await createBot(input);
    return NextResponse.json({ bot: botToDto(bot) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
