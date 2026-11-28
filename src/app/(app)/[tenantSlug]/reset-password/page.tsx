import type { Metadata } from "next";

import { TenantResetPasswordForm } from "@/features/auth/components/tenant-reset-password-form";

export const metadata: Metadata = {
  title: "Set your password",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ tenantSlug: string }>;
};

export default async function TenantResetPasswordPage({ params }: PageProps) {
  const { tenantSlug } = await params;

  return <TenantResetPasswordForm tenantSlug={tenantSlug} />;
}
