import type { Metadata } from "next";
import { AuthSplitShell } from "@/features/auth/components/auth-card";
import { AuthShowcase } from "@/features/auth/components/auth-showcase";
import { AUTH_COLUMN_CLASS } from "@/features/auth/components/auth-styles";
import { loginErrorMessage } from "@/features/auth/login-errors";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your workspace.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function LoginPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const errorParam = searchParams.error;
  // Only a known code is shown; free text in `?error=` is dropped.
  const initialError = loginErrorMessage(
    Array.isArray(errorParam) ? errorParam[0] : errorParam,
  );

  const nextParam = searchParams.next;
  const next = Array.isArray(nextParam) ? nextParam[0] : nextParam;

  return (
    <AuthSplitShell
      showcase={<AuthShowcase variant="signin" />}
      contentClassName={AUTH_COLUMN_CLASS}
    >
      <LoginForm initialError={initialError} next={next} />
    </AuthSplitShell>
  );
}
