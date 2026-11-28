"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Play } from "lucide-react";
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
import { DEMO_LOGIN_ENABLED } from "@/features/auth/demo-accounts";
import { PasswordInput } from "@/components/ui/password-input";
import { APP_ROUTES } from "@/lib/routes";

const ERROR_HEADLINE: Record<AuthFailureCode, string> = {
  invalid_credentials: "Invalid email or password. Please try again.",
  email_not_confirmed: "Confirm your email first.",
  rate_limited: "Too many attempts.",
  validation: "Check your details.",
  no_workspace_access: "This is another team's workspace.",
  unknown: "We couldn't sign you in.",
};

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

        {DEMO_LOGIN_ENABLED && (
          <Button
            asChild
            variant="outline"
            className={AUTH_SOCIAL_BUTTON_CLASS}
          >
            <Link href={APP_ROUTES.DEMO_LOGIN}>
              <Play className="size-4 text-brand-accent" aria-hidden />
              Try demo login
            </Link>
          </Button>
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
