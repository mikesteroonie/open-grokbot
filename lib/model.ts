import { xai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";

const DEFAULT_MODEL_ID = "grok-4.6";

/**
 * Grok, via xAI — this is a Grok Bot homage, after all. Requires
 * XAI_API_KEY. Override the exact model with AI_MODEL_ID.
 */
export function getModel(): LanguageModel {
  if (!process.env.XAI_API_KEY) {
    throw new Error(
      "XAI_API_KEY is missing. Add it to .env.local (see .env.example) to give your bots a brain.",
    );
  }
  return xai(process.env.AI_MODEL_ID || DEFAULT_MODEL_ID);
}
