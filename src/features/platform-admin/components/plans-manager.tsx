"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Info, Loader2, Pencil } from "lucide-react";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  TEAM_DIALOG_CONTENT,
  TEAM_DIALOG_FOOTER,
  TEAM_DIALOG_TITLE,
  TEAM_MODAL_BUTTON,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import { savePlatformPlanAction } from "../actions/platform-plans.actions";
import { formatCurrency, formatNumber } from "../format";
import { planLimitError } from "../plan-limits";
import { PLAN_FEATURES, UNLIMITED_SEATS, type PlatformPlan } from "../types";
import { PlanComparison } from "./plan-comparison";
import {
  PLATFORM_BUTTON,
  PLATFORM_CARD,
  PlatformPageHeader,
} from "./platform-ui";
import { ToneBadge } from "./status-badge";

function limitText(value: number | null, suffix = ""): string {
  return value === null || value >= UNLIMITED_SEATS
    ? "Unlimited"
    : `${formatNumber(value)}${suffix}`;
}

function storageText(mb: number | null): string {
  if (mb === null) return "—";

  return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

type PlanFeature = (typeof PLAN_FEATURES)[number];

/** The whole tile is the label, so a phone gets a full-size tap target. */
function FeatureGroup({
  title,
  features,
  values,
  onChange,
}: {
  title: string;
  features: readonly PlanFeature[];
  values: PlatformPlan["features"];
  onChange: (values: PlatformPlan["features"]) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        {features.map((feature) => (
          <label
            key={feature.key}
            className="flex min-h-9 min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-border px-2.5 py-1 transition-colors hover:bg-muted/40 sm:min-h-10 sm:px-3"
          >
            <span className="min-w-0 text-xs leading-tight break-words text-foreground sm:text-sm">
              {feature.label}
            </span>
            <Switch
              size="sm"
              checked={values[feature.key]}
              onCheckedChange={(checked) =>
                onChange({ ...values, [feature.key]: checked })
              }
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function EditPlanDialog({
  plan,
  onClose,
}: {
  plan: PlatformPlan;
  onClose: () => void;
}) {
  const router = useRouter();
  const [description, setDescription] = useState(plan.description);
  const [unlimitedSeats, setUnlimitedSeats] = useState(
    plan.seatLimit >= UNLIMITED_SEATS,
  );
  const [seatLimit, setSeatLimit] = useState(
    plan.seatLimit >= UNLIMITED_SEATS ? "1" : String(plan.seatLimit),
  );
  const [unlimitedSla, setUnlimitedSla] = useState(plan.slaPolicies === -1);
  const [slaLimit, setSlaLimit] = useState(
    plan.slaPolicies === -1 ? "1" : String(plan.slaPolicies),
  );
  const [features, setFeatures] = useState(plan.features);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>(
    {},
  );
  const [isSaving, startSaving] = useTransition();

  function checkLimit(field: "seatLimit" | "slaPolicies", text: string) {
    const error = planLimitError(text);

    setErrors((current) => ({
      ...current,
      [field]: error ? [error] : undefined,
    }));

    return !error;
  }

  function clearError(field: "seatLimit" | "slaPolicies") {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function save() {
    // Not short-circuited, so both fields show their error at once.
    const seatsOk = unlimitedSeats || checkLimit("seatLimit", seatLimit);
    const slaOk = unlimitedSla || checkLimit("slaPolicies", slaLimit);

    if (!seatsOk || !slaOk) return;

    startSaving(async () => {
      const result = await savePlatformPlanAction({
        id: plan.id,
        description,
        seatLimit: unlimitedSeats ? UNLIMITED_SEATS : Number(seatLimit),
        slaPolicies: unlimitedSla ? -1 : Number(slaLimit),
        features,
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message);
        return;
      }

      toast.success(`${plan.name} plan saved.`);
      router.refresh();
      onClose();
    });
  }

  const workspacesNote =
    plan.workspaces === 0
      ? "No live workspaces are on this plan yet."
      : `Applies right away to ${plan.workspaces} live workspace${plan.workspaces === 1 ? "" : "s"}.`;

  return (
    <>
      <DialogHeader>
        <DialogTitle className={TEAM_DIALOG_TITLE}>
          Edit {plan.name} plan
        </DialogTitle>
        <DialogDescription className="sr-only sm:not-sr-only">
          Price and name can&apos;t change here: PayPal billing and access rules
          depend on them.
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
        <ModalNotice icon={Info} tone="amber">
          {workspacesNote}{" "}
          <span className="hidden sm:inline">
            Lowering seats removes nobody, but blocks new invites.
          </span>
        </ModalNotice>

        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="plan-description" className="h-5">
              Description
            </Label>
            <Textarea
              id="plan-description"
              rows={2}
              maxLength={300}
              className="h-14 min-h-0 resize-none sm:h-16 md:h-[4.5rem]"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description[0]}
              </p>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-3 md:gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex h-5 items-center justify-between gap-1">
                <Label htmlFor="plan-seats" className="truncate">
                  Seat limit
                </Label>
                <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                  No limit
                  <Switch
                    size="sm"
                    aria-label="No limit on seats"
                    checked={unlimitedSeats}
                    onCheckedChange={(checked) => {
                      setUnlimitedSeats(checked);
                      clearError("seatLimit");
                    }}
                  />
                </label>
              </div>
              <Input
                id="plan-seats"
                type={unlimitedSeats ? "text" : "number"}
                min={1}
                className="h-10 rounded-lg"
                disabled={unlimitedSeats}
                aria-invalid={Boolean(errors.seatLimit)}
                value={unlimitedSeats ? "Unlimited" : seatLimit}
                onChange={(event) => {
                  setSeatLimit(event.target.value);
                  clearError("seatLimit");
                }}
                onBlur={(event) => {
                  if (!unlimitedSeats) {
                    checkLimit("seatLimit", event.target.value);
                  }
                }}
              />
              {errors.seatLimit && (
                <p className="text-xs text-destructive">
                  {errors.seatLimit[0]}
                </p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex h-5 items-center justify-between gap-1">
                <Label htmlFor="plan-sla" className="truncate">
                  SLA limit
                </Label>
                <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                  No limit
                  <Switch
                    size="sm"
                    aria-label="No limit on SLA policies"
                    checked={unlimitedSla}
                    onCheckedChange={(checked) => {
                      setUnlimitedSla(checked);
                      clearError("slaPolicies");
                    }}
                  />
                </label>
              </div>
              <Input
                id="plan-sla"
                type={unlimitedSla ? "text" : "number"}
                min={1}
                className="h-10 rounded-lg"
                disabled={unlimitedSla}
                aria-invalid={Boolean(errors.slaPolicies)}
                value={unlimitedSla ? "Unlimited" : slaLimit}
                onChange={(event) => {
                  setSlaLimit(event.target.value);
                  clearError("slaPolicies");
                }}
                onBlur={(event) => {
                  if (!unlimitedSla) {
                    checkLimit("slaPolicies", event.target.value);
                  }
                }}
              />
              {errors.slaPolicies && (
                <p className="text-xs text-destructive">
                  {errors.slaPolicies[0]}
                </p>
              )}
            </div>
          </div>
        </div>

        <FeatureGroup
          title="Controls access"
          features={PLAN_FEATURES.filter((feature) => feature.enforced)}
          values={features}
          onChange={setFeatures}
        />
        <FeatureGroup
          title="Shown on the pricing page only"
          features={PLAN_FEATURES.filter((feature) => !feature.enforced)}
          values={features}
          onChange={setFeatures}
        />
      </div>

      <DialogFooter className={cn(TEAM_DIALOG_FOOTER, "flex-row")}>
        <Button
          variant="outline"
          className={cn(TEAM_MODAL_BUTTON, "flex-1 sm:flex-none")}
          disabled={isSaving}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          className={cn(
            TEAM_MODAL_BUTTON,
            TEAM_MODAL_BUTTON_PRIMARY,
            "flex-1 sm:flex-none",
          )}
          disabled={isSaving}
          onClick={save}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Save plan
        </Button>
      </DialogFooter>
    </>
  );
}

export function PlansManager({ plans }: { plans: PlatformPlan[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = plans.find((plan) => plan.id === editingId);

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        title="Plans & Features"
        description="What each plan costs, includes and who is on it."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {plans.map((plan) => (
          <section
            key={plan.id}
            className={cn(PLATFORM_CARD, "flex flex-col gap-4 p-4 sm:p-5")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {plan.name}
                  </h2>
                  {!plan.isActive && <ToneBadge tone="muted">Hidden</ToneBadge>}
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                )}
                <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatCurrency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / month
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                className={cn(PLATFORM_BUTTON, "gap-1.5")}
                aria-label={`Edit ${plan.name} plan`}
                onClick={() => setEditingId(plan.id)}
              >
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Fact
                label="Live workspaces"
                value={formatNumber(plan.workspaces)}
              />
              <Fact label="MRR" value={formatCurrency(plan.mrr)} />
              <Fact label="Seats" value={limitText(plan.seatLimit)} />
              <Fact label="Tickets" value={limitText(plan.ticketLimit)} />
              <Fact label="Storage" value={storageText(plan.storageLimitMb)} />
            </div>
          </section>
        ))}
      </div>

      <PlanComparison plans={plans} />

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditingId(null)}
      >
        <DialogContent
          // Focusing the first field opens a phone's keyboard over the popup.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl min-w-0 gap-3 overflow-x-hidden overflow-y-auto sm:max-w-3xl",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {editing && (
            <EditPlanDialog
              key={editing.id}
              plan={editing}
              onClose={() => setEditingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
