"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleAlert } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { PasswordInput } from "@/components/ui/password-input";
import { PageLoader } from "@/components/shared/page-loader";
import { useEmailLinkSession } from "@/features/auth/hooks/use-email-link-session";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { toast } from "sonner";
import {
  checkPasswordAccessAction,
  updatePasswordAction,
} from "@/features/auth/actions/actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const {
    verifying: isExchangingToken,
    error: authError,
    block,
  } = useEmailLinkSession(checkPasswordAccessAction);
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
        const result = await updatePasswordAction(values);

        if (!result.success) {
          if (result.reason === "retry") {
            form.setError("root", { message: result.error });
          } else {
            // A dead link or removed access: typing again can't fix it.
            await createSupabaseClient().auth.signOut({ scope: "local" });
            block(result.reason, result.error);
          }

          toast.error("Couldn't update your password", {
            description: result.error,
          });
          return;
        }

        // The server signed the link's session out; clear this tab's copy,
        // so /login shows the form instead of bouncing to the dashboard.
        await createSupabaseClient().auth.signOut({ scope: "local" });

        toast.success("Password updated", {
          description: "Taking you to sign in with your new password.",
        });

        setUpdated(true);

        setTimeout(() => {
          router.push("/login");
        }, 3000);
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

  if (isExchangingToken) {
    return <PageLoader />;
  }

  return (
    <AuthShell>
      <div className="flex h-full w-full items-center justify-center bg-background px-4 py-12">
        <Form {...form}>
          <AuthCard onSubmit={form.handleSubmit(onSubmit)}>
            {updated ? (
              <div className="flex flex-col items-start gap-3">
                <span
                  aria-hidden
                  className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success-strong"
                >
                  <Check className="size-5.5" strokeWidth={2} />
                </span>

                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Password reset complete
                </h1>

                <p className="text-sm text-muted-foreground">
                  Your password has been updated. Redirecting to sign in...
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Set new password
                  </h1>

                  <p className="text-sm text-muted-foreground">
                    Enter your new password below.
                  </p>
                </div>

                {(authError || form.formState.errors.root) && (
                  <Alert
                    variant="destructive"
                    className="rounded-[10px] px-3.5 py-3"
                  >
                    <CircleAlert className="size-4.5" aria-hidden />

                    <AlertDescription className="text-sm">
                      {authError || form.formState.errors.root?.message}
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
                          disabled={isPending || Boolean(authError)}
                          className="h-11 rounded-lg text-sm"
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
                          disabled={isPending || Boolean(authError)}
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
                  disabled={isPending || Boolean(authError)}
                  className="h-11 font-semibold"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      Updating...
                    </span>
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
