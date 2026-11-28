"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CircleDot,
  CreditCard,
  Loader2,
  Mail,
  Save,
  Settings,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { UnsavedChangesDialog } from "@/components/shared/unsaved-changes-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";

import { savePlatformSettingsAction } from "../actions/platform-settings.actions";
import {
  PAYMENT_GRACE_DAYS_MAX,
  PAYMENT_GRACE_DAYS_MIN,
  type PlatformSettings,
} from "../types";
import {
  PLATFORM_BUTTON,
  PLATFORM_CARD,
  PlatformPageHeader,
} from "./platform-ui";

/**
 * One settings group: its title and description on the left, its fields in a
 * card on the right (stacked on narrow screens).
 */
function SettingsSection({
  icon: Icon,
  tint,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  tint: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <div className="flex items-start gap-3 lg:pt-1">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            tint,
          )}
        >
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-base font-bold tracking-tight text-foreground">
            {title}
          </h2>
          <p className="text-sm leading-relaxed text-slate-500">
            {description}
          </p>
        </div>
      </div>
      <div className={cn(PLATFORM_CARD, "flex flex-col p-5")}>{children}</div>
    </section>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "-m-2 flex items-center justify-between gap-4 rounded-lg p-3 transition-colors",
        checked && "bg-amber-50/70 dark:bg-amber-950/20",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        <span className="text-sm text-slate-500">{description}</span>
        {checked && (
          <span className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <CircleDot className="size-3.5" aria-hidden />
            On: tenants are blocked
          </span>
        )}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return (
    <p id={id} className="text-xs text-destructive">
      {messages[0]}
    </p>
  );
}

export function PlatformSettingsForm({
  initial,
  available,
}: {
  initial: PlatformSettings;
  available: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [settings, setSettings] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [isSaving, startSaving] = useTransition();

  const dirty =
    settings.platformName !== saved.platformName ||
    settings.supportEmail !== saved.supportEmail ||
    settings.maintenanceMode !== saved.maintenanceMode ||
    settings.paymentGraceDays !== saved.paymentGraceDays;
  const leaveGuard = useUnsavedChangesGuard(dirty);

  function update(patch: Partial<PlatformSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function onSave() {
    startSaving(async () => {
      const result = await savePlatformSettingsAction(settings);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error("Couldn't save platform settings", {
          description: result.message,
        });
        return;
      }

      setFieldErrors({});
      setSaved(result.settings);
      setSettings(result.settings);
      toast.success("Platform settings saved", {
        description: result.settings.maintenanceMode
          ? "Maintenance mode is on: tenants are blocked until you turn it off."
          : "The changes apply to every workspace right away.",
      });
    });
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8">
      <PlatformPageHeader
        eyebrow="Configuration"
        icon={Settings}
        title="Platform settings"
        description="Global configuration applied to every workspace."
      />

      {!available && (
        <ModalNotice icon={AlertTriangle} tone="danger">
          These settings can&apos;t be loaded from the database, so they
          aren&apos;t being applied. Check that migration
          20261031130000_platform_settings has been applied.
        </ModalNotice>
      )}

      <SettingsSection
        icon={Settings}
        tint="bg-brand-50 text-brand-700"
        title="Platform information"
        description="Basic details about your platform."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="platform-name" className="font-semibold">
              Platform name
            </Label>
            <Input
              id="platform-name"
              className="h-10 rounded-lg"
              value={settings.platformName}
              maxLength={80}
              aria-invalid={Boolean(fieldErrors.platformName)}
              aria-describedby="platform-name-error"
              onChange={(event) => update({ platformName: event.target.value })}
            />
            <FieldError
              id="platform-name-error"
              messages={fieldErrors.platformName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="support-email" className="font-semibold">
              Support email
            </Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                strokeWidth={1.75}
                aria-hidden
              />
              <Input
                id="support-email"
                type="email"
                className="h-10 rounded-lg pl-9"
                value={settings.supportEmail}
                aria-invalid={Boolean(fieldErrors.supportEmail)}
                aria-describedby="support-email-error"
                onChange={(event) =>
                  update({ supportEmail: event.target.value })
                }
              />
            </div>
            <FieldError
              id="support-email-error"
              messages={fieldErrors.supportEmail}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={CreditCard}
        tint="bg-sky-50 text-sky-600"
        title="Billing"
        description="What happens when a subscription payment fails."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Label
              htmlFor="payment-grace-days"
              className="text-sm font-semibold text-foreground"
            >
              Grace period after a failed payment
            </Label>
            <span className="text-sm text-muted-foreground">
              Starts at the first failed payment. The workspace keeps its plan
              while PayPal retries, and any successful payment ends it. If it
              runs out unpaid, the workspace moves to the Free plan and keeps
              access.
            </span>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
            <div className="relative">
              <Input
                id="payment-grace-days"
                type="number"
                inputMode="numeric"
                min={PAYMENT_GRACE_DAYS_MIN}
                max={PAYMENT_GRACE_DAYS_MAX}
                className="h-10 w-32 rounded-lg pr-12"
                value={
                  Number.isNaN(settings.paymentGraceDays)
                    ? ""
                    : settings.paymentGraceDays
                }
                aria-invalid={Boolean(fieldErrors.paymentGraceDays)}
                aria-describedby="payment-grace-days-error"
                onChange={(event) =>
                  update({
                    paymentGraceDays:
                      event.target.value === ""
                        ? Number.NaN
                        : Number(event.target.value),
                  })
                }
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-400">
                days
              </span>
            </div>
            <FieldError
              id="payment-grace-days-error"
              messages={fieldErrors.paymentGraceDays}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Wrench}
        tint="bg-amber-50 text-amber-600"
        title="Maintenance"
        description="Put the platform in maintenance mode."
      >
        <ToggleRow
          id="maintenance-mode"
          label="Maintenance mode"
          description="Block tenant access and show a maintenance banner."
          checked={settings.maintenanceMode}
          onCheckedChange={(checked) => update({ maintenanceMode: checked })}
        />
      </SettingsSection>

      {/* Stays in view at the bottom while scrolling; says when there are changes. */}
      <div
        className={cn(
          PLATFORM_CARD,
          "sticky bottom-0 z-10 flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between",
          dirty &&
            "border-brand-700/30! shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]",
        )}
      >
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              dirty ? "bg-amber-500" : "bg-slate-300",
            )}
          />
          {dirty ? "You have unsaved changes" : "All changes saved"}
        </p>
        <Button
          onClick={onSave}
          disabled={!dirty || isSaving || !available}
          className={cn(PLATFORM_BUTTON, "w-full gap-1.5 sm:w-auto")}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Save className="size-4" aria-hidden />
          )}
          Save changes
        </Button>
      </div>

      <UnsavedChangesDialog
        open={leaveGuard.pendingHref !== null}
        onStay={leaveGuard.stay}
        onLeave={leaveGuard.leave}
        description="Your platform settings haven't been saved. If you leave this page now, they will be lost."
      />
    </div>
  );
}
