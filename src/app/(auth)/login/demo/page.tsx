import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AuthShell } from "@/features/auth/components/auth-card";
import { DemoLogin } from "@/features/auth/components/demo-login";
import { DEMO_LOGIN_ENABLED } from "@/features/auth/demo-accounts";
import { APP_ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Demo login",
  description: "Explore the demo as any role.",
  alternates: { canonical: APP_ROUTES.DEMO_LOGIN },
  robots: { index: false, follow: false },
};

/**
 * "Try demo login": every demo role, what it is responsible for, and a button
 * that signs in as it. Only for demo sites; anywhere else it goes to /login.
 */
export default function DemoLoginPage() {
  if (!DEMO_LOGIN_ENABLED) {
    redirect(APP_ROUTES.LOGIN);
  }

  return (
    <AuthShell>
      <div className="flex w-full max-w-5xl flex-col items-center gap-8">
        <header className="flex max-w-2xl flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-balance text-foreground md:text-3xl">
            Explore the demo
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
            Pick a role to see what that person does in the help desk. One click
            signs you in with a demo account. To try another role, come back to
            this page and pick it.
          </p>
        </header>

        <DemoLogin />

        <Link
          href={APP_ROUTES.LOGIN}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
