"use client";

import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { BotAvatar } from "@/components/bot-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AVATAR_COLORS, AVATAR_SHAPES, colorHex } from "@/lib/avatars";
import { cn } from "@/lib/utils";
import { ErrorNotice, readApiError, toApiErrorDto } from "@/components/error-notice";
import type { ApiErrorDto, BotDto, BotTemplateDto } from "@/lib/types";

/** Mirrors lib/bots.ts slugify() so the address preview matches the server. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "bot"
  );
}

const DEFAULT_PERSONALITY = (name: string) => `You are ${name}, a bot working for your principal.

You are an email participant with your own real inbox and address. Figure out what your principal needs, use your tools, and get it done. Read a thread before acting on it, keep emails short with one clear ask, sign with your own name, and escalate to your principal when something is irreversible or above your remit.`;

/**
 * Grok Bot-style creation screen: avatar preview, color and shape
 * pickers, a name, and a rail of suggested bots.
 */
export function NewBotScreen({
  templates,
  domain,
  onCreated,
}: {
  templates: BotTemplateDto[];
  /** Email domain new bots are provisioned on (for the address preview). */
  domain?: string;
  onCreated: (bot: BotDto) => void;
}) {
  const [color, setColor] = useState("blue");
  const [shape, setShape] = useState("circle");
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tagline, setTagline] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  // Explicit email username — set when the user picks a suggestion after a
  // "taken" error, or edits the address line. Empty = derive from name.
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorDto | null>(null);

  const effectiveUsername = username.trim() || slugify(name);
  const showAddress = Boolean(name.trim() || username.trim());

  function applyTemplate(t: BotTemplateDto) {
    setUsername("");
    setError(null);
    setName(t.name);
    setColor(t.color);
    setShape(t.shape);
    setTagline(t.tagline);
    setInstructions(t.personality);
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          username: username.trim() || undefined,
          tagline: tagline.trim() || undefined,
          personality: instructions.trim() || DEFAULT_PERSONALITY(trimmed),
          color,
          shape,
        }),
      });
      if (!res.ok) throw await readApiError(res, "Failed to create bot");
      const data = await res.json();
      onCreated(data.bot as BotDto);
    } catch (err) {
      setError(toApiErrorDto(err, "Failed to create bot"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <BotAvatar color={color} shape={shape} className="size-5" />
        <span className="text-sm font-medium">{name.trim() || "New Bot"}</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-6 py-8">
        <BotAvatar color={color} shape={shape} className="size-20" />

        <div className="flex items-center gap-2.5">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={`Color ${c.id}`}
              onClick={() => setColor(c.id)}
              className={cn(
                "size-5 rounded-full transition-transform hover:scale-110",
                color === c.id && "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {AVATAR_SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`Shape ${s}`}
              onClick={() => setShape(s)}
              className={cn(
                "rounded-lg p-1 transition-colors hover:bg-accent",
                shape === s && "ring-1 ring-foreground/60",
              )}
            >
              <BotAvatar color={color} shape={s} className="size-6" />
            </button>
          ))}
        </div>

        <div className="w-full max-w-xs space-y-1.5 pt-2">
          <label htmlFor="bot-name" className="text-sm text-muted-foreground">
            Name
          </label>
          <Input
            id="bot-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="New Bot"
            maxLength={60}
            className="h-10 rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
          {showAddress && (
            <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <span>Address:</span>
              <span className="flex min-w-0 items-center">
                <input
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""));
                    if (error) setError(null);
                  }}
                  placeholder={slugify(name)}
                  aria-label="Email username"
                  maxLength={40}
                  size={Math.max(effectiveUsername.length, 3)}
                  className="field-sizing-content min-w-[3ch] max-w-[14rem] flex-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="truncate">@{domain ?? "…"}</span>
              </span>
            </div>
          )}
        </div>

        {showInstructions ? (
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Instructions — who is this bot and what does it do over email?"
            maxLength={4000}
            className="min-h-28 w-full max-w-md"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowInstructions(true)}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {instructions ? "Edit instructions" : "Add instructions (optional)"}
          </button>
        )}

        {error && (
          <ErrorNotice
            error={error}
            className="w-full max-w-md"
            onSuggestion={(s) => {
              setUsername(s);
              setError(null);
            }}
          />
        )}

        <Button
          onClick={create}
          disabled={busy || !name.trim()}
          variant="secondary"
          className="rounded-lg px-5"
        >
          {busy && <LoaderCircleIcon className="animate-spin" />}
          Get started
        </Button>
      </div>

      <div className="shrink-0 px-5 pb-5">
        <div className="mb-2 text-sm text-muted-foreground">Suggestions</div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {templates.map((t) => (
            <button
              key={t.username}
              type="button"
              onClick={() => applyTemplate(t)}
              className="flex w-72 shrink-0 items-start gap-3 rounded-xl border bg-card/60 px-4 py-4 text-left transition-colors hover:bg-accent/50"
            >
              <span
                className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${colorHex(t.color)}1f` }}
              >
                <BotAvatar color={t.color} shape={t.shape} className="size-8" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium">{t.name}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                  {t.tagline}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
