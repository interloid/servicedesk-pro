"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { CircleAlert, CircleCheck, Clock, ShieldX } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AuthCard, AuthShell } from "@/features/auth/components/auth-card";
import { createSupabaseClient } from "@/lib/supabase/client";

import {
  UpdatePasswordValues,
  updatePasswordSchema,
} from "@/features/auth/schemas/reset-password";
import { useEmailLinkSession } from "@/features/auth/hooks/use-email-link-session";

import {
  checkTenantPasswordAccessAction,
  updateTenantPasswordAction,
} from "@/features/auth/actions/actions";
import { PageLoader } from "@/components/shared/page-loader";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { tenantLoginPath } from "@/lib/tenancy";

/** How long the "saved" state shows before it moves on to sign in. */
const REDIRECT_SECONDS = 2;

type StatusTone = "success" | "danger";

const STATUS_TONES: Record<
  StatusTone,
  { circle: string; icon: string; badge: string }
> = {
  success: {
    circle: "bg-emerald-100 dark:bg-emerald-950/50",
    icon: "text-emerald-600 dark:text-emerald-400",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  danger: {
    circle: "bg-destructive/10 dark:bg-destructive/20",
    icon: "text-destructive",
    badge: "border-destructive/30 bg-destructive/5 text-destructive",
  },
};

/**
 * The page's end states -- saved, expired, no access -- laid out like the
 * payment result card: a round icon, a centred title and description, a
 * details box, and the way on in a footer under a divider.
 */
function StatusPanel({
  tone,
  icon: Icon,
  title,
  description,
  email,
  status,
  note,
  footer,
  plainFooter = false,
}: {
  tone: StatusTone;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: ReactNode;
  email: string | null;
  status: string;
  note?: ReactNode;
  footer: ReactNode;
  /** A message rather than a button: white, so it doesn't read as a tray of actions. */
  plainFooter?: boolean;
}) {
  const styles = STATUS_TONES[tone];

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden
          className={cn(
            "mb-2 flex size-16 items-center justify-center rounded-full",
            styles.circle,
          )}
        >
          <Icon className={cn("size-10", styles.icon)} strokeWidth={1.75} />
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>

        <p
          role="status"
          className="text-sm leading-[1.6] text-muted-foreground"
        >
          {description}
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-muted/50 p-4 text-left">
        {email && (
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="shrink-0 font-medium text-muted-foreground">
              Account
            </span>
            <span className="truncate font-semibold text-foreground">
              {email}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="font-medium text-muted-foreground">Status</span>
          <Badge variant="outline" className={styles.badge}>
            {status}
          </Badge>
        </div>
      </div>

      {note && (
        <p className="text-center text-xs text-muted-foreground">{note}</p>
      )}

      <div
        className={cn(
          "-mx-5 -mb-6 flex flex-col gap-2 rounded-b-2xl border-t px-5 py-4 md:-mx-8 md:-mb-8 md:px-8",
          plainFooter ? "bg-card" : "bg-muted/50",
        )}
      >
        {footer}
      </div>
    </>
  );
}

/** Counts down to the redirect so the move to sign in is expected. */
function RedirectCountdown() {
  const [left, setLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (left <= 0) return;
    const tick = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(tick);
  }, [left]);

  return left > 0 ? (
    <>
      Redirecting to the sign-in page in{" "}
      <span className="font-bold text-foreground">{left}</span>{" "}
      {left === 1 ? "second" : "seconds"}…
    </>
  ) : (
    "Opening the sign-in page…"
  );
}

export function TenantResetPasswordForm({
  tenantSlug,
}: {
  tenantSlug: string;
}) {
  const router = useRouter();

  const {
    verifying: isVerifyingSession,
    error: authError,
    blockedReason,
    isFirstPassword,
    isInviteLink,
    email: linkEmail,
    block,
  } = useEmailLinkSession(() => checkTenantPasswordAccessAction(tenantSlug));
  const [updated, setUpdated] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  function onSubmit(values: UpdatePasswordValues) {
    startTransition(async () => {
      form.clearErrors("root");

      try {
        // Saved on the server, which checks the membership again: an admin
        // can revoke the invite while this page sits open.
        const result = await updateTenantPasswordAction(values, tenantSlug);

        if (!result.success) {
          if (result.reason === "retry") {
            form.setError("root", { message: result.error });
            toast.error("Couldn't update your password", {
              description: result.error,
            });
            return;
          }

          await createSupabaseClient().auth.signOut({ scope: "local" });
          block(result.reason, result.error);
          toast.error("Couldn't update your password", {
            description: result.error,
          });
          return;
        }

        // The server signed the link's session out; clear this tab's copy.
        await createSupabaseClient().auth.signOut({ scope: "local" });

        setUpdated(true);
        toast.success(isFirstPassword ? "Password set" : "Password updated", {
          description: isFirstPassword
            ? "Taking you to sign in so you can open your workspace."
            : "Taking you to sign in with your new password.",
        });

        setTimeout(() => {
          router.push(tenantLoginPath(tenantSlug));
        }, REDIRECT_SECONDS * 1000);
      } catch (error) {
        console.error(
          "[Reset Password] Unexpected password update error:",
          error,
        );

        const message =
          "We couldn't update your password. Check your connection and try again.";

        form.setError("root", { message });
        toast.error("Couldn't update your password", { description: message });
      }
    });
  }

  if (isVerifyingSession) {
    return <PageLoader />;
  }

  return (
    <AuthShell>
      <div className="flex h-full w-full items-center justify-center bg-background px-4 py-12">
        <Form {...form}>
          <AuthCard onSubmit={form.handleSubmit(onSubmit)}>
            {updated ? (
              <StatusPanel
                tone="success"
                icon={CircleCheck}
                title={isFirstPassword ? "You're all set" : "Password updated"}
                description={
                  isFirstPassword
                    ? "Your password is saved. Sign in with it to open your workspace."
                    : "Your new password is saved. Use it the next time you sign in."
                }
                email={linkEmail}
                status="Password set"
                note={<RedirectCountdown />}
                footer={
                  // Don't make them wait, and a way on if the redirect stalls.
                  <Button asChild className="h-10 w-full font-semibold">
                    <Link href={tenantLoginPath(tenantSlug)}>
                      Continue to sign in
                    </Link>
                  </Button>
                }
              />
            ) : authError ? (
              // A dead link or revoked access can't be fixed by typing, so
              // the form goes away and the way forward takes its place.
              <StatusPanel
                tone="danger"
                icon={blockedReason === "no-access" ? ShieldX : Clock}
                title={
                  blockedReason === "no-access"
                    ? "Access removed"
                    : isInviteLink
                      ? "Invitation expired"
                      : "Link expired"
                }
                description={authError}
                email={linkEmail}
                status={
                  blockedReason === "no-access" ? "No access" : "Link expired"
                }
                note={
                  blockedReason === "expired" &&
                  isFirstPassword &&
                  !isInviteLink
                    ? "Opening an invitation? Your workspace admin can also resend it from Team & roles."
                    : undefined
                }
                plainFooter={isInviteLink}
                footer={
                  // An invitee has no password yet, so sign in leads nowhere;
                  // only their admin can send a new invitation. Button height,
                  // so the card is the same size either way.
                  isInviteLink ? (
                    <p className="flex h-10 items-center justify-center text-center text-sm font-semibold text-foreground">
                      Contact your admin to get a new invitation.
                    </p>
                  ) : (
                    <Button asChild className="h-10 w-full font-semibold">
                      <Link href={tenantLoginPath(tenantSlug)}>
                        Back to sign in
                      </Link>
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {isFirstPassword
                      ? "Set your password"
                      : "Set a new password"}
                  </h1>

                  <p className="text-sm text-muted-foreground">
                    {isFirstPassword
                      ? "Choose a password to finish joining the workspace. At least 8 characters."
                      : "Choose a new password for your account. At least 8 characters."}
                  </p>
                </div>

                {form.formState.errors.root && (
                  <Alert
                    variant="destructive"
                    className="rounded-[10px] px-3.5 py-3"
                  >
                    <CircleAlert className="size-4.5" aria-hidden />

                    <AlertDescription className="text-sm">
                      {form.formState.errors.root?.message}
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="font-semibold text-foreground">
                        New password
                      </FormLabel>

                      <FormControl>
                        <PasswordInput
                          placeholder="••••••••"
                          disabled={isPending}
                          className="h-11 rounded-sm pr-10 text-sm"
                          {...field}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel className="font-semibold text-foreground">
                        Confirm password
                      </FormLabel>

                      <FormControl>
                        <PasswordInput
                          placeholder="••••••••"
                          disabled={isPending}
                          className="h-11 rounded-lg text-sm"
                          {...field}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-11 font-semibold"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      Saving...
                    </span>
                  ) : isFirstPassword ? (
                    "Set password"
                  ) : (
                    "Update password"
                  )}
                </Button>
              </>
            )}
          </AuthCard>
        </Form>
      </div>
    </AuthShell>
  );
}
