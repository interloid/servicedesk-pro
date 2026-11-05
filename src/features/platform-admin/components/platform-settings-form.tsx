"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Loader2,
  Save,
  Settings,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { UnsavedChangesDialog } from "@/components/shared/unsaved-changes-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";

import { savePlatformSettingsAction } from "../actions/platform-settings.actions";
import type { PlatformSettings } from "../types";
import {
  PLATFORM_BUTTON,
  PLATFORM_CARD,
  PlatformPageHeader,
} from "./platform-ui";

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(PLATFORM_CARD, "gap-0 p-4 sm:p-5")}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </Card>
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
    <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        <span className="text-sm text-muted-foreground">{description}</span>
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
    settings.allowSignups !== saved.allowSignups ||
    settings.maintenanceMode !== saved.maintenanceMode ||
    settings.blockOnPaymentFailure !== saved.blockOnPaymentFailure;
  const leaveGuard = useUnsavedChangesGuard(dirty);

  function update(patch: Partial<PlatformSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function onSave() {
    startSaving(async () => {
      const result = await savePlatformSettingsAction(settings);

      if (!result.success) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }

      setFieldErrors({});
      setSaved(result.settings);
      setSettings(result.settings);
      toast.success("Platform settings saved.");
    });
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <PlatformPageHeader
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
        title="Platform Information"
        description="Basic details about your platform."
      >
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
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
            <Input
              id="support-email"
              type="email"
              className="h-10 rounded-lg"
              value={settings.supportEmail}
              aria-invalid={Boolean(fieldErrors.supportEmail)}
              aria-describedby="support-email-error"
              onChange={(event) => update({ supportEmail: event.target.value })}
            />
            <FieldError
              id="support-email-error"
              messages={fieldErrors.supportEmail}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Users}
        title="Access"
        description="Control who can create and keep a workspace."
      >
        <ToggleRow
          id="allow-signups"
          label="Allow new signups"
          description="Let anyone create a workspace from the landing page."
          checked={settings.allowSignups}
          onCheckedChange={(checked) => update({ allowSignups: checked })}
        />
        <ToggleRow
          id="block-on-payment-failure"
          label="Block after failed payments"
          description="Block a workspace when its subscription is cancelled over failed payments. It can still reach billing, and subscribing again restores it."
          checked={settings.blockOnPaymentFailure}
          onCheckedChange={(checked) =>
            update({ blockOnPaymentFailure: checked })
          }
        />
      </SettingsSection>

      <SettingsSection
        icon={Wrench}
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

      <div className="flex justify-end border-t border-border pt-5">
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
