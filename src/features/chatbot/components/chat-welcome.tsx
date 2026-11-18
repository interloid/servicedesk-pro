"use client";

import { BookOpen, Clock, Plus, Search, type LucideIcon } from "lucide-react";

/**
 * The empty chat: an illustration, a greeting and four starter cards. Each
 * card sends a prompt the assistant's tools can answer (draft a request, list
 * requests, the portal guide) -- never one it would have to decline.
 */
const STARTERS: Array<{ icon: LucideIcon; label: string; prompt: string }> = [
  { icon: Plus, label: "Create a new request", prompt: "Report a new problem" },
  {
    icon: Search,
    label: "Check request status",
    prompt: "Show my open requests",
  },
  {
    icon: Clock,
    label: "What's waiting on me?",
    prompt: "What's waiting on me?",
  },
  {
    icon: BookOpen,
    label: "How this portal works",
    prompt: "What can I do in this portal?",
  },
];

export function ChatWelcome({
  firstName,
  onPick,
  disabled = false,
}: {
  firstName: string;
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-1 pt-2 text-center">
      <WelcomeIllustration />

      <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">
        Hi{firstName ? ` ${firstName}` : ""}!{" "}
        <span role="img" aria-label="waving hand">
          👋
        </span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        I&apos;m your AI support assistant. I can check on your requests,
        explain how this portal works, or help you raise a new request.
      </p>

      <div className="mt-5 w-full border-t" />

      <p className="mt-4 self-start text-sm font-semibold text-foreground">
        Try asking me…
      </p>
      <ul className="mt-3 grid w-full grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
        {STARTERS.map(({ icon: Icon, label, prompt }) => (
          <li key={label}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              className="flex h-full w-full items-center gap-2.5 rounded-xl border bg-background px-3.5 py-3 text-left text-sm font-medium text-foreground shadow-xs transition-all outline-none hover:-translate-y-px hover:border-brand-accent/50 hover:bg-brand-accent/5 focus-visible:ring-3 focus-visible:ring-brand-accent/25 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icon className="size-4 shrink-0 text-brand-ink" aria-hidden />
              <span className="min-w-0">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A friendly robot at a laptop, drawn in the tenant's brand colour
 * (currentColor) so it matches the panel header for any brand.
 */
function WelcomeIllustration() {
  return (
    <svg
      viewBox="0 0 240 150"
      className="h-auto w-48 text-brand-accent sm:w-52"
      aria-hidden
    >
      {/* Soft backdrop */}
      <ellipse
        cx="120"
        cy="80"
        rx="88"
        ry="62"
        fill="currentColor"
        opacity="0.08"
      />
      <circle cx="190" cy="112" r="30" fill="currentColor" opacity="0.06" />
      <circle cx="52" cy="118" r="22" fill="currentColor" opacity="0.06" />

      {/* Sparkles */}
      <path
        d="M58 52 L61 61 L70 64 L61 67 L58 76 L55 67 L46 64 L55 61 Z"
        fill="currentColor"
      />
      <path
        d="M184 30 L186 36 L192 38 L186 40 L184 46 L182 40 L176 38 L182 36 Z"
        fill="currentColor"
        opacity="0.35"
      />

      {/* Antenna */}
      <line
        x1="120"
        y1="20"
        x2="120"
        y2="34"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="120"
        cy="16"
        r="5.5"
        fill="currentColor"
        className="motion-safe:animate-pulse"
      />

      {/* Body */}
      <rect
        x="96"
        y="92"
        width="48"
        height="40"
        rx="16"
        fill="white"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect
        x="110"
        y="104"
        width="20"
        height="5"
        rx="2.5"
        fill="currentColor"
        opacity="0.25"
      />

      {/* Head + headphones */}
      <rect x="78" y="48" width="12" height="26" rx="6" fill="currentColor" />
      <rect x="150" y="48" width="12" height="26" rx="6" fill="currentColor" />
      <rect
        x="86"
        y="34"
        width="68"
        height="56"
        rx="24"
        fill="white"
        stroke="currentColor"
        strokeWidth="2.5"
      />

      {/* Visor and face */}
      <rect x="96" y="46" width="48" height="32" rx="15" fill="#0f172a" />
      <ellipse cx="111" cy="59" rx="4" ry="5" fill="currentColor" />
      <ellipse cx="129" cy="59" rx="4" ry="5" fill="currentColor" />
      <path
        d="M113 68 Q120 74 127 68"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Arm resting on the laptop */}
      <path
        d="M140 110 Q156 112 156 124"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Laptop */}
      <path d="M44 100 H108 L116 134 H52 Z" fill="currentColor" />
      <circle cx="81" cy="117" r="5" fill="white" opacity="0.9" />
      <rect x="40" y="132" width="122" height="6" rx="3" fill="currentColor" />
      <rect
        x="40"
        y="132"
        width="122"
        height="6"
        rx="3"
        fill="black"
        opacity="0.15"
      />
    </svg>
  );
}
