"use client";

import { useEffect, useState } from "react";
import { LoaderCircleIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ApiErrorDto, BotDto, ContactDto } from "@/lib/types";
import { ErrorNotice, readApiError, toApiErrorDto } from "@/components/error-notice";

/**
 * Per-bot contact list. A contact is a name, an email address, and a
 * description of what they do — injected into the bot's system prompt so
 * it knows who to email for what. Other bots on the roster can be added
 * with one click, which is how bots learn to coordinate with each other.
 */
export function ContactsSheet({
  bot,
  allBots,
}: {
  bot: BotDto;
  allBots: BotDto[];
}) {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactDto[]>(bot.contacts ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorDto | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    fetch(`/api/bots/${encodeURIComponent(bot.id)}/contacts`)
      .then(async (r) => {
        if (!r.ok) throw await readApiError(r, "Failed to load contacts");
        const data = await r.json();
        if (mounted) setContacts(data.contacts ?? []);
      })
      .catch((err) => {
        if (mounted) setError(toApiErrorDto(err, "Failed to load contacts"));
      });
    return () => {
      mounted = false;
    };
  }, [open, bot.id]);

  async function save(next: ContactDto[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(bot.id)}/contacts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: next }),
      });
      if (!res.ok) throw await readApiError(res, "Failed to save contacts");
      const data = await res.json();
      setContacts(data.contacts ?? next);
    } catch (err) {
      setError(toApiErrorDto(err, "Failed to save contacts"));
    } finally {
      setBusy(false);
    }
  }

  const contactEmails = new Set(contacts.map((c) => c.email.toLowerCase()));
  const addableBots = allBots.filter(
    (b) => b.id !== bot.id && !contactEmails.has(b.email.toLowerCase()),
  );

  function addBot(b: BotDto) {
    save([
      ...contacts,
      { name: b.name, email: b.email, description: b.tagline || "Fellow bot." },
    ]);
  }

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    save([
      ...contacts,
      { name: name.trim(), email: email.trim(), description: description.trim() },
    ]);
    setName("");
    setEmail("");
    setDescription("");
  }

  function remove(target: ContactDto) {
    save(contacts.filter((c) => c.email !== target.email));
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <UsersIcon /> Contacts
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{bot.name}&apos;s contacts</SheetTitle>
          <SheetDescription>
            The bot&apos;s entire world. It can only email, and be emailed
            by, the people here (plus you). Everyone else is rejected at
            the mail layer, in both directions.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 px-4 pb-4">
            {addableBots.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Add a bot
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {addableBots.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={busy}
                      onClick={() => addBot(b)}
                    >
                      <Badge
                        variant="outline"
                        className="cursor-pointer gap-1 py-1 hover:bg-accent"
                      >
                        <PlusIcon className="size-3" />
                        {b.name}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Add anyone
              </div>
              <form onSubmit={addManual} className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    aria-label="Contact name"
                    maxLength={60}
                  />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    aria-label="Contact email"
                    type="email"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What they do (helps the bot delegate)"
                    aria-label="Contact description"
                    maxLength={300}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="icon"
                    aria-label="Add contact"
                    disabled={busy || !name.trim() || !email.trim()}
                    className="shrink-0"
                  >
                    {busy ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
                  </Button>
                </div>
              </form>
            </div>

            {error && <ErrorNotice error={error} />}

            <Separator />

            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No contacts yet. This bot only knows its principal.
              </p>
            ) : (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li
                    key={c.email}
                    className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.email}
                      </div>
                      {c.description && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.description}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${c.name}`}
                      disabled={busy}
                      onClick={() => remove(c)}
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
