"use client";

import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const FRIENDLY_NAMES: Record<string, string> = {
  send_email: "Sending email",
  reply_to_email: "Replying",
  list_threads: "Reading inbox",
  get_thread: "Reading thread",
  web_search: "Searching the web",
  notify_principal: "Emailing you",
};

export function ToolChip({ name, state }: { name: string; state: string }) {
  const label = FRIENDLY_NAMES[name] ?? name.replace(/_/g, " ");
  const working = state === "input-streaming" || state === "input-available";
  const failed = state === "output-error";

  return (
    <Badge variant="secondary" className="my-1 gap-1.5 rounded-full font-normal">
      {working ? (
        <LoaderCircleIcon className="animate-spin" />
      ) : failed ? (
        <XIcon className="text-destructive" />
      ) : (
        <CheckIcon className="text-muted-foreground" />
      )}
      {label}
      {working && "…"}
    </Badge>
  );
}
