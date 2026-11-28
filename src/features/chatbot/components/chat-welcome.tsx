"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Clock,
  FilePlus2,
  FileText,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";

import { PORTAL_ROUTES, portalPath } from "@/features/portal/portal";

/**
 * The empty chat, laid out like a support messenger's home: a greeting, a card
 * of things to ask, and a card of the other ways to get help. Each starter
 * sends a prompt the assistant's tools can answer (draft a request, list
 * requests, the portal guide) -- never one it would have to decline.
 */
const STARTERS: Array<{
  icon: LucideIcon;
  label: string;
  hint: string;
  prompt: string;
}> = [
  {
    icon: Plus,
    label: "Create a new request",
    hint: "Describe the problem and get a draft to confirm",
    prompt: "Report a new problem",
  },
  {
    icon: Search,
    label: "Check request status",
    hint: "See where your open requests stand",
    prompt: "Show my open requests",
  },
  {
    icon: Clock,
    label: "What's waiting on me?",
    hint: "Requests that need your reply",
    prompt: "What's waiting on me?",
  },
  {
    icon: FileText,
    label: "How this portal works",
    hint: "What you can do here",
    prompt: "What can I do in this portal?",
  },
];

export function ChatWelcome({
  slug,
  firstName,
  onPick,
  disabled = false,
}: {
  slug: string;
  firstName: string;
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="px-1 pt-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">
          {firstName ? `Hi ${firstName}` : "Hi there"}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          How can we help today? Pick a topic or type your question below.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border bg-background">
        <h4 className="border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground">
          Ask about
        </h4>
        <ul className="divide-y">
          {STARTERS.map(({ icon: Icon, label, hint, prompt }) => (
            <li key={label}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(prompt)}
                className={ROW}
              >
                <RowContent icon={Icon} label={label} hint={hint} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border bg-background">
        <h4 className="border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground">
          Other ways to get help
        </h4>
        <ul className="divide-y">
          <li>
            <Link href={portalPath(slug, PORTAL_ROUTES.HELP)} className={ROW}>
              <RowContent
                icon={BookOpen}
                label="Browse the help centre"
                hint="Guides and common answers"
              />
            </Link>
          </li>
          <li>
            <Link
              href={portalPath(slug, PORTAL_ROUTES.NEW_REQUEST)}
              className={ROW}
            >
              <RowContent
                icon={FilePlus2}
                label="Fill in the request form"
                hint="Write to the support team directly"
              />
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

const ROW =
  "group flex w-full items-center gap-3 px-4 py-3 text-left text-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 disabled:pointer-events-none disabled:opacity-50";

function RowContent({
  icon: Icon,
  label,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground transition-colors group-hover:text-brand-accent"
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5"
      />
    </>
  );
}
