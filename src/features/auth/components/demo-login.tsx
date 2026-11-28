"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AUTH_PRIMARY_BUTTON_CLASS } from "@/features/auth/components/auth-styles";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/features/auth/demo-accounts";
import { useLogin } from "@/features/auth/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * One credential with a copy button that ticks. A secret value stays masked
 * until the eye button reveals it, so it isn't read off the screen by default.
 */
function CredentialRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hidden = secret && !revealed;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // The value can still be revealed and copied by hand.
    }
  }

  const iconButton =
    "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand-accent/20";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] text-foreground",
          hidden ? "tracking-[0.2em] text-slate-500" : "select-all",
        )}
        title={hidden ? undefined : value}
      >
        {hidden ? "••••••••" : value}
      </span>
      {secret && (
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={
            revealed
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          aria-pressed={revealed}
          className={cn(
            iconButton,
            "text-slate-400 hover:bg-slate-100 hover:text-foreground",
          )}
        >
          {revealed ? (
            <EyeOff className="size-3.5" aria-hidden />
          ) : (
            <Eye className="size-3.5" aria-hidden />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `${label} copied` : `Copy ${label.toLowerCase()}`}
        className={cn(
          iconButton,
          copied
            ? "bg-brand-accent/10 text-brand-accent"
            : "text-slate-400 hover:bg-slate-100 hover:text-foreground",
        )}
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}

function RoleCard({
  account,
  busy,
  pending,
  error,
  onSignIn,
}: {
  account: DemoAccount;
  busy: boolean;
  pending: boolean;
  error: string | null;
  onSignIn: (account: DemoAccount) => void;
}) {
  const Icon = account.icon;

  return (
    <li className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            account.tint,
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-bold text-foreground">
            {account.role}
          </h2>
          <p className="text-sm leading-normal text-muted-foreground">
            {account.description}
          </p>
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {account.responsibilities.map((line) => (
          <li
            key={line}
            className="flex items-start gap-2 text-sm leading-normal text-foreground"
          >
            <Check
              className="mt-0.5 size-4 shrink-0 text-brand-accent"
              aria-hidden
            />
            {line}
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Opens: <span className="text-foreground">{account.landsOn}</span>
      </p>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() => onSignIn(account)}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Logging in…
            </>
          ) : (
            <>
              Log in as {account.role}
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <details className="group rounded-[10px] border bg-slate-50/70 dark:bg-muted/20">
        <summary className="cursor-pointer rounded-[10px] px-3 py-2 text-xs font-medium text-muted-foreground outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-brand-accent/20">
          Sign-in details
        </summary>
        <div className="border-t pb-1">
          <CredentialRow label="Email" value={account.email} />
          <CredentialRow label="Password" value={account.password} secret />
        </div>
      </details>
    </li>
  );
}

/**
 * The demo page's role cards. A button signs in through the normal login
 * action, so errors, rate limits and the redirect to the role's own landing
 * page are the same as on the sign-in form.
 */
export function DemoLogin() {
  const { login, isPending } = useLogin();
  const [pickedEmail, setPickedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(account: DemoAccount) {
    setError(null);
    setPickedEmail(account.email);

    const result = await login({
      email: account.email,
      password: account.password,
      remember: false,
    });

    if (!result.success) {
      setError(result.message);
    }
  }

  return (
    <ul className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {DEMO_ACCOUNTS.map((account) => (
        <RoleCard
          key={account.email}
          account={account}
          busy={isPending}
          pending={isPending && pickedEmail === account.email}
          error={pickedEmail === account.email ? error : null}
          onSignIn={signIn}
        />
      ))}
    </ul>
  );
}
