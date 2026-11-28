"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleAlert,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  MapPin,
  Minus,
} from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AuthCard } from "@/features/auth/components/auth-card";
import {
  AUTH_CARD_CLASS,
  AUTH_CHECKBOX_CLASS,
  AUTH_FIELD_CLASS,
  AUTH_FIELD_ITEM_CLASS,
  AUTH_FIELD_STACK_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SOCIAL_BUTTON_CLASS,
} from "@/features/auth/components/auth-styles";
import { GoogleIcon } from "@/features/auth/components/google-icon";
import { useGoogleLogin, useLogin } from "@/features/auth/hooks/use-auth";
import { loginSchema, type LoginValues } from "@/features/auth/schemas/login";
import type { AuthFailureCode } from "@/features/auth/types";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/features/auth/demo-accounts";
import { PasswordInput } from "@/components/ui/password-input";
import { APP_ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ERROR_HEADLINE: Record<AuthFailureCode, string> = {
  invalid_credentials: "Invalid email or password. Please try again.",
  email_not_confirmed: "Confirm your email first.",
  rate_limited: "Too many attempts.",
  validation: "Check your details.",
  no_workspace_access: "This is another team's workspace.",
  unknown: "We couldn't sign you in.",
};

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
    <div className="flex items-center gap-2 px-3 py-2">
      {/* On a phone the label sits above the value, so a long email is shown
          in full (wrapping if it must) instead of cut down to a few letters. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground sm:w-28 sm:shrink-0">
          {label}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 text-[13px] break-words text-foreground sm:truncate",
            hidden ? "tracking-[0.2em] text-slate-500" : "select-all",
          )}
          title={hidden ? undefined : value}
        >
          {hidden ? "••••••••" : <BreakAtAt value={value} />}
        </span>
      </div>
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

/**
 * The hover card on a demo tile: who the role is, what it can reach and where
 * it opens, so a visitor can pick the right one before signing in. A light
 * card rather than the default dark tooltip, to match the tiles.
 */
function RoleDetailsCard({ account }: { account: DemoAccount }) {
  const Icon = account.icon;
  const { org, purpose, can, cannot, landsOn } = account.details;

  return (
    <TooltipContent
      side="top"
      sideOffset={8}
      collisionPadding={12}
      // The base arrow is drawn in the dark tooltip colour; this card is
      // light, so it goes without one (the last child is that arrow).
      className="w-76 max-w-[calc(100vw-1.5rem)] flex-col items-stretch gap-0 rounded-xl border border-slate-200 bg-card p-0 text-left text-foreground shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22),0_2px_6px_rgba(15,23,42,0.06)] [&>span:last-child]:hidden"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-3.5 py-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            account.tint,
          )}
        >
          <Icon className="size-4.5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm leading-tight font-semibold">
            {account.role}
          </span>
          <span className="text-[11px] leading-snug text-muted-foreground">
            {org}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-3 px-3.5 py-3">
        <p className="text-xs leading-relaxed text-slate-600">{purpose}</p>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold tracking-[0.08em] text-slate-400 uppercase">
            What you can do
          </span>
          <ul className="flex flex-col gap-1.5">
            {can.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-xs leading-snug text-slate-700"
              >
                <Check
                  className="mt-px size-3.5 shrink-0 text-brand-accent"
                  strokeWidth={2.5}
                  aria-hidden
                />
                {item}
              </li>
            ))}
            {cannot && (
              <li className="flex items-start gap-2 text-xs leading-snug text-slate-500">
                <Minus
                  className="mt-px size-3.5 shrink-0 text-slate-300"
                  strokeWidth={2.5}
                  aria-hidden
                />
                {cannot}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50/80 px-3.5 py-2 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="size-3 shrink-0" aria-hidden />
          <span className="truncate">Opens on {landsOn}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 font-medium text-brand-accent">
          <LogIn className="size-3" aria-hidden />
          Click to sign in
        </span>
      </div>
    </TooltipContent>
  );
}

/** Lets a wrapping email break just before the "@" instead of mid-word. */
function BreakAtAt({ value }: { value: string }) {
  const at = value.indexOf("@");
  if (at <= 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <wbr />
      {value.slice(at)}
    </>
  );
}

/**
 * "Explore a demo": always visible under the sign-in form, one click per
 * role. A tile fills the form above and submits it, so sign-in, errors and
 * redirects are the normal path. The raw credentials stay behind "View
 * sign-in details" (password masked) for anyone who wants to type them.
 * Rendered only in demo mode, with only the roles whose credentials are set.
 */
function DemoSection({
  busy,
  pendingEmail,
  onPick,
}: {
  busy: boolean;
  pendingEmail: string | null;
  onPick: (account: DemoAccount) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const mainPassword = DEMO_ACCOUNTS[0]?.password ?? "";
  const ownPasswords = DEMO_ACCOUNTS.filter(
    (item) => item.password !== mainPassword,
  );

  return (
    <section
      aria-labelledby="demo-heading"
      className="flex flex-col gap-3 rounded-xl border border-slate-200! bg-slate-50/70 p-3.5 dark:bg-muted/20"
    >
      <div className="flex flex-col gap-0.5 px-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
        <h2 id="demo-heading" className="text-sm font-semibold text-foreground">
          Explore a demo account
        </h2>
        <span className="text-xs text-muted-foreground">
          One click, no sign-up
        </span>
      </div>

      {/* One per row on a phone: two columns there left room for only the
          first three letters of each role. */}
      {/* A short delay, so sweeping the pointer across the tiles does not
          flash every card on the way. */}
      <TooltipProvider delayDuration={250}>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account, index) => {
            const Icon = account.icon;
            const pending = pendingEmail === account.email;
            const lastOdd =
              index === DEMO_ACCOUNTS.length - 1 &&
              DEMO_ACCOUNTS.length % 2 === 1;
            return (
              <li
                key={account.email}
                className={cn(lastOdd && "sm:col-span-2")}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPick(account)}
                      aria-label={`Sign in to the demo as ${account.role}`}
                      className="group flex w-full items-center gap-2.5 rounded-[10px] border border-slate-200! bg-card px-2.5 py-2 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all outline-none hover:border-brand-accent/50! hover:shadow-[0_2px_8px_rgba(15,118,110,0.10)] focus-visible:ring-3 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          account.tint,
                        )}
                      >
                        {pending ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Icon
                            className="size-4"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        )}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] leading-tight font-semibold text-foreground">
                          {account.role}
                        </span>
                        <span className="truncate text-[11px] leading-tight text-muted-foreground">
                          {pending ? "Signing in…" : account.summary}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-3.5 shrink-0 -translate-x-1 text-brand-accent opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                        aria-hidden
                      />
                    </button>
                  </TooltipTrigger>
                  <RoleDetailsCard account={account} />
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </TooltipProvider>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={showDetails}
          aria-controls="demo-credentials"
          onClick={() => setShowDetails((value) => !value)}
          className="mx-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-brand-accent/20"
        >
          {showDetails ? "Hide sign-in details" : "View sign-in details"}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              showDetails && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        {showDetails && (
          <div
            id="demo-credentials"
            className="divide-y divide-slate-100! rounded-[10px] border border-slate-200! bg-card"
          >
            {DEMO_ACCOUNTS.map((account) => (
              <CredentialRow
                key={account.email}
                label={account.role}
                value={account.email}
              />
            ))}
            <CredentialRow label="Password" value={mainPassword} secret />
            {ownPasswords.map((account) => (
              <CredentialRow
                key={`${account.email}-password`}
                label={`${account.role.split(" ")[0]} password`}
                value={account.password}
                secret
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function LoginForm({
  initialError,
  next,
}: {
  initialError?: string;
  next?: string;
}) {
  const { login, isPending } = useLogin({ next });
  const { signInWithGoogle, isPending: isGooglePending } = useGoogleLogin({
    next,
  });

  const form = useForm<LoginValues>({
    defaultValues: { email: "", password: "", remember: false },
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginValues) {
    form.clearErrors("root");

    const result = await login(values);

    if (result.success) {
      return;
    }

    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      const message = messages?.[0];
      if (message) {
        form.setError(field as keyof LoginValues, { message });
      }
    }

    form.setError("root", { type: result.code, message: result.message });
  }

  async function onGoogleSignIn() {
    form.clearErrors("root");

    const result = await signInWithGoogle();

    if (!result.success) {
      form.setError("root", { type: result.code, message: result.message });
    }
  }

  const [demoEmail, setDemoEmail] = useState<string | null>(null);

  async function onDemoPick(account: DemoAccount) {
    setDemoEmail(account.email);
    form.setValue("email", account.email, { shouldValidate: true });
    form.setValue("password", account.password, { shouldValidate: true });
    await form.handleSubmit(onSubmit)();
    setDemoEmail(null);
  }

  const formError = form.formState.errors.root;
  const bannerMessage = formError?.message ?? initialError;
  const errorHeadline =
    ERROR_HEADLINE[(formError?.type as AuthFailureCode) ?? "unknown"];
  const busy = isPending || isGooglePending;

  return (
    <Form {...form}>
      <AuthCard
        onSubmit={form.handleSubmit(onSubmit)}
        className={AUTH_CARD_CLASS}
      >
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-[-0.02.5em] text-balance text-foreground">
            Sign in to your workspace
          </h1>
          <p className="text-sm leading-[1.6] text-muted-foreground">
            Work your queue against live SLA targets.
          </p>
        </div>

        {bannerMessage && (
          <Alert variant="destructive" className="rounded-[10px] px-3.5 py-3">
            <CircleAlert className="size-4.5" aria-hidden />
            <AlertDescription className="text-sm leading-[1.55]">
              <span className="font-bold">{errorHeadline}</span> {bannerMessage}
            </AlertDescription>
          </Alert>
        )}

        <div className={AUTH_FIELD_STACK_CLASS}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem id="login-email" className={AUTH_FIELD_ITEM_CLASS}>
                <FormLabel className={AUTH_LABEL_CLASS}>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@northwind.io"
                    className={AUTH_FIELD_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem id="login-password" className={AUTH_FIELD_ITEM_CLASS}>
                <FormLabel className={AUTH_LABEL_CLASS}>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="••••••••••"
                    className={AUTH_FIELD_CLASS}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <FormField
              control={form.control}
              name="remember"
              render={({ field }) => (
                <FormItem
                  id="login-remember"
                  className="flex flex-row items-center gap-2.5"
                >
                  <FormControl>
                    <Checkbox
                      name={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      className={AUTH_CHECKBOX_CLASS}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal text-foreground cursor-pointer">
                    Keep me signed in
                  </FormLabel>
                </FormItem>
              )}
            />
            <Link
              href={APP_ROUTES.FORGOT_PASSWORD}
              className="text-sm font-semibold text-brand-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            type="submit"
            disabled={busy}
            className={AUTH_PRIMARY_BUTTON_CLASS}
          >
            {isPending ? "Signing in…" : "Sign in"}
          </Button>

          <div className="flex items-center gap-2.5 text-xs text-muted-foreground/80">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onGoogleSignIn}
            className={AUTH_SOCIAL_BUTTON_CLASS}
          >
            <GoogleIcon className="size-5" />
            {isGooglePending
              ? "Redirecting to Google…"
              : "Continue with Google"}
          </Button>
        </div>

        {DEMO_ACCOUNTS.length > 0 && (
          <DemoSection
            busy={busy}
            pendingEmail={isPending ? demoEmail : null}
            onPick={onDemoPick}
          />
        )}

        <p className="text-center text-sm text-muted-foreground">
          New here?
          <Link
            href={APP_ROUTES.SETUP}
            className="ml-1 font-semibold text-brand-accent hover:underline"
          >
            Create an organization
          </Link>
        </p>
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          Customer? Sign in here, or use the link in your support emails.
        </p>
      </AuthCard>
    </Form>
  );
}
