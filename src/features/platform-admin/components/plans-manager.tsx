"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  Building2,
  CircleCheck,
  CreditCard,
  Crown,
  Eye,
  EyeOff,
  Gem,
  HardDrive,
  Info,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  RotateCcw,
  Sprout,
  Ticket,
  Timer,
  Users,
  type LucideIcon,
} from "lucide-react";

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
  TEAM_MODAL_BUTTON_DANGER,
  TEAM_MODAL_BUTTON_PRIMARY,
} from "@/features/team/components/modal-buttons";
import { cn } from "@/lib/utils";

import {
  createPlatformPlanAction,
  savePlatformPlanAction,
  setPlatformPlanActiveAction,
} from "../actions/platform-plans.actions";
import { formatCurrency, formatNumber } from "../format";
import { planLimitError } from "../plan-limits";
import { PLAN_FEATURES, UNLIMITED_SEATS, type PlatformPlan } from "../types";
import { PlanComparison } from "./plan-comparison";
import {
  PLATFORM_BUTTON,
  PLATFORM_CARD,
  PlatformPageHeader,
} from "./platform-ui";
import { StatCard } from "./stat-card";
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

/**
 * One look per plan, by its place in the list (cheapest first), matching the
 * plan badges on the Tenants page: Free grey, Pro teal, Business violet.
 */
const PLAN_TONES = [
  { icon: Sprout, tint: "bg-slate-100 text-slate-600" },
  { icon: Rocket, tint: "bg-brand-50 text-brand-700" },
  { icon: Building2, tint: "bg-violet-50 text-violet-600" },
  { icon: Gem, tint: "bg-sky-50 text-sky-600" },
  { icon: Crown, tint: "bg-amber-50 text-amber-600" },
] as const;

/** A plan's business figure in a small tile (workspaces, MRR). */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-slate-50 px-3.5 py-3 dark:bg-muted/40">
      <span className="truncate text-xs font-medium text-slate-500">
        {label}
      </span>
      <span className="text-lg leading-tight font-bold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

/** One limit as a small column: icon and label over the value. */
function Fact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 px-2 text-center">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon
          className="size-3.5 shrink-0 text-slate-400"
          strokeWidth={1.75}
          aria-hidden
        />
        {label}
      </span>
      <span className="truncate text-sm font-semibold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

type PlanFeature = (typeof PLAN_FEATURES)[number];

/** A dialog heading with a round tinted icon, as on the role dialog. */
function DialogIconHeader({
  icon: Icon,
  tint = "bg-brand-50 text-brand-700",
  title,
  description,
  descriptionClassName,
}: {
  icon: LucideIcon;
  tint?: string;
  title: ReactNode;
  description: ReactNode;
  descriptionClassName?: string;
}) {
  return (
    <DialogHeader className="flex-row items-start gap-3.5 pr-6 text-left">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          tint,
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <DialogTitle className={cn(TEAM_DIALOG_TITLE, "font-heading")}>
          {title}
        </DialogTitle>
        <DialogDescription
          className={cn("leading-relaxed", descriptionClassName)}
        >
          {description}
        </DialogDescription>
      </div>
    </DialogHeader>
  );
}

/** A small uppercase label over a group of fields. */
function SectionLabel({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
        {children}
      </p>
      {aside && <span className="text-xs text-slate-400">{aside}</span>}
    </div>
  );
}

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
  const on = features.filter((feature) => values[feature.key]).length;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <SectionLabel aside={`${on} of ${features.length} on`}>
        {title}
      </SectionLabel>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        {features.map((feature) => (
          <label
            key={feature.key}
            className={cn(
              "flex min-h-10 min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1 transition-colors sm:px-3",
              values[feature.key]
                ? "border-brand-700/35! bg-brand-700/5"
                : "hover:border-slate-400! hover:bg-slate-50",
            )}
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
        toast.error(`Couldn't save the ${plan.name} plan`, {
          description: result.message,
        });
        return;
      }

      toast.success(`${plan.name} plan updated`, {
        description:
          plan.workspaces > 0
            ? `The new limits and features apply right away to ${plan.workspaces} live workspace${plan.workspaces === 1 ? "" : "s"}.`
            : "No live workspaces are on this plan yet.",
      });
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
      <DialogIconHeader
        icon={Pencil}
        title={`Edit ${plan.name} plan`}
        description="Price and name can't change here: PayPal billing and access rules depend on them."
        descriptionClassName="sr-only sm:not-sr-only"
      />

      <div className="flex min-w-0 flex-col gap-5">
        <ModalNotice icon={Info} tone="amber">
          {workspacesNote}{" "}
          <span className="hidden sm:inline">
            Lowering seats removes nobody, but blocks new invites.
          </span>
        </ModalNotice>

        <div className="flex min-w-0 flex-col gap-2">
          <SectionLabel aside={`${description.length}/300`}>
            Description
          </SectionLabel>
          <Label htmlFor="plan-description" className="sr-only">
            Description
          </Label>
          <Textarea
            id="plan-description"
            rows={2}
            maxLength={300}
            className="h-16 min-h-0 resize-none rounded-lg"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description[0]}</p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <SectionLabel>Limits</SectionLabel>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="plan-seats"
                  className="flex items-center gap-2 truncate"
                >
                  <Users
                    className="size-4 shrink-0 text-slate-400"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Seat limit
                </Label>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
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

            <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor="plan-sla"
                  className="flex items-center gap-2 truncate"
                >
                  <Timer
                    className="size-4 shrink-0 text-slate-400"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  SLA limit
                </Label>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
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
          title="Features that control access"
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

type FieldErrors = Record<string, string[] | undefined>;

function FieldError({ errors, name }: { errors: FieldErrors; name: string }) {
  const message = errors[name]?.[0];

  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

/**
 * A new paid plan. It starts hidden, so its features can be set with Edit
 * before anyone can choose it.
 */
function CreatePlanDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [code, setCode] = useState("");
  const [seatLimit, setSeatLimit] = useState("5");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSaving, startSaving] = useTransition();

  function clear(field: string) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function save() {
    startSaving(async () => {
      const result = await createPlatformPlanAction({
        name,
        code: code.trim().toUpperCase(),
        price: price.trim() === "" ? Number.NaN : Number(price),
        description,
        seatLimit: Number(seatLimit),
      });

      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast.error("Couldn't create the plan", {
          description: result.message,
        });
        return;
      }

      toast.success(`${name.trim()} plan created`, {
        description:
          "It's hidden from sign-up for now. Set its features with Edit, then choose Show to make it available.",
      });
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogIconHeader
        icon={Plus}
        title="New plan"
        description="Create the billing plan in PayPal first, under the same product as the other paid plans, then paste its plan ID here."
      />

      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionLabel>Plan details</SectionLabel>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="new-plan-name">Name</Label>
              <Input
                id="new-plan-name"
                maxLength={40}
                className="h-10 rounded-lg"
                placeholder="e.g. Enterprise"
                aria-invalid={Boolean(errors.name)}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clear("name");
                }}
              />
              <FieldError errors={errors} name="name" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="new-plan-seats">Seat limit</Label>
              <div className="relative">
                <Users
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <Input
                  id="new-plan-seats"
                  type="number"
                  min={1}
                  className="h-10 rounded-lg pl-9"
                  aria-invalid={Boolean(errors.seatLimit)}
                  value={seatLimit}
                  onChange={(event) => {
                    setSeatLimit(event.target.value);
                    clear("seatLimit");
                  }}
                />
              </div>
              <FieldError errors={errors} name="seatLimit" />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label
              htmlFor="new-plan-description"
              className="flex items-baseline justify-between"
            >
              Description
              <span className="text-xs font-normal text-slate-400 tabular-nums">
                {description.length}/300
              </span>
            </Label>
            <Textarea
              id="new-plan-description"
              rows={2}
              maxLength={300}
              placeholder="Who this plan is for"
              className="h-16 min-h-0 resize-none rounded-lg"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <FieldError errors={errors} name="description" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <SectionLabel>Billing</SectionLabel>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="new-plan-price">Price per month (USD)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-slate-400">
                  $
                </span>
                <Input
                  id="new-plan-price"
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="h-10 rounded-lg pr-16 pl-7"
                  placeholder="99"
                  aria-invalid={Boolean(errors.price)}
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    clear("price");
                  }}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-slate-400">
                  / month
                </span>
              </div>
              <FieldError errors={errors} name="price" />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="new-plan-code">PayPal plan ID</Label>
              <Input
                id="new-plan-code"
                autoComplete="off"
                className="h-10 rounded-lg font-mono"
                placeholder="P-…"
                aria-invalid={Boolean(errors.code)}
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  clear("code");
                }}
              />
              <FieldError errors={errors} name="code" />
            </div>
          </div>
          <ModalNotice icon={Info} tone="neutral">
            The price must match the PayPal plan: PayPal charges what its own
            plan says. Neither can be changed here later.
          </ModalNotice>
        </div>
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
          Create plan
        </Button>
      </DialogFooter>
    </>
  );
}

/** Deprecate (hide from new choices) or show again. Plans are never deleted. */
function PlanVisibilityDialog({
  plan,
  onClose,
}: {
  plan: PlatformPlan;
  onClose: () => void;
}) {
  const router = useRouter();
  const deprecating = plan.isActive;
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function submit() {
    startSaving(async () => {
      const result = await setPlatformPlanActiveAction({
        id: plan.id,
        isActive: !deprecating,
      });

      if (!result.success) {
        setError(result.message);
        return;
      }

      toast.success(
        deprecating
          ? `${plan.name} plan deprecated`
          : `${plan.name} plan is available again`,
        {
          description: deprecating
            ? "New workspaces can't choose it. Workspaces already on it keep it and stay billed."
            : "Workspaces can choose it on sign-up and the plans page.",
        },
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <DialogIconHeader
        icon={deprecating ? Archive : Eye}
        tint={
          deprecating
            ? "bg-amber-50 text-amber-600"
            : "bg-brand-50 text-brand-700"
        }
        title={`${deprecating ? "Deprecate" : "Show"} the ${plan.name} plan?`}
        description={
          deprecating
            ? "No new workspace can choose it. Here's what happens:"
            : "Workspaces can choose it again. Here's what happens:"
        }
      />

      <ul className="flex flex-col gap-2.5 rounded-lg border border-border bg-slate-50/60 p-4 text-sm text-slate-600 dark:bg-muted/30">
        {(deprecating
          ? [
              {
                icon: EyeOff,
                text: "It disappears from sign-up and the plans page.",
              },
              {
                icon: CreditCard,
                text: "Workspaces already on it keep it and keep being billed.",
              },
              {
                icon: RotateCcw,
                text: "Plans are never deleted: you can show it again any time.",
              },
            ]
          : [
              {
                icon: Eye,
                text: "It appears on sign-up and the plans page again.",
              },
              { icon: CircleCheck, text: "Workspaces can choose it." },
            ]
        ).map(({ icon: ItemIcon, text }) => (
          <li key={text} className="flex items-start gap-2.5">
            <ItemIcon
              className="mt-0.5 size-4 shrink-0 text-slate-400"
              strokeWidth={1.75}
              aria-hidden
            />
            {text}
          </li>
        ))}
      </ul>

      {deprecating && plan.workspaces > 0 && (
        <ModalNotice icon={Info} tone="amber">
          {plan.workspaces} live workspace
          {plan.workspaces === 1 ? " stays" : "s stay"} on this plan.
        </ModalNotice>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

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
          variant={deprecating ? "outline" : "default"}
          className={cn(
            TEAM_MODAL_BUTTON,
            deprecating ? TEAM_MODAL_BUTTON_DANGER : TEAM_MODAL_BUTTON_PRIMARY,
            "flex-1 sm:flex-none",
          )}
          disabled={isSaving}
          onClick={submit}
        >
          {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {deprecating ? "Deprecate plan" : "Show plan"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function PlansManager({ plans }: { plans: PlatformPlan[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [visibilityId, setVisibilityId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const editing = plans.find((plan) => plan.id === editingId);
  const changingVisibility = plans.find((plan) => plan.id === visibilityId);

  // Summary figures for the cards above the plans; display only.
  const activePlans = plans.filter((plan) => plan.isActive).length;
  const totalWorkspaces = plans.reduce((sum, plan) => sum + plan.workspaces, 0);
  const totalMrr = plans.reduce((sum, plan) => sum + plan.mrr, 0);
  const popular = plans.reduce<PlatformPlan | null>(
    (best, plan) => (plan.workspaces > (best?.workspaces ?? 0) ? plan : best),
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <PlatformPageHeader
        eyebrow="Billing &amp; product"
        icon={Layers}
        title="Plans & Features"
        description="What each plan costs, includes and who is on it."
        action={
          <Button
            className={cn(PLATFORM_BUTTON, "gap-1.5")}
            onClick={() => setCreating(true)}
          >
            <Plus className="size-4" aria-hidden />
            New plan
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active plans"
          value={`${activePlans} / ${plans.length}`}
          hint={
            plans.length - activePlans > 0
              ? `${plans.length - activePlans} deprecated`
              : "None deprecated"
          }
          icon={Layers}
          iconClassName="bg-brand-50 text-brand-700"
        />
        <StatCard
          label="Live workspaces"
          value={formatNumber(totalWorkspaces)}
          hint="Across every plan"
          icon={Building2}
          iconClassName="bg-sky-50 text-sky-600"
        />
        <StatCard
          label="MRR"
          value={formatCurrency(totalMrr)}
          hint="From paid plans"
          icon={CreditCard}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Most popular"
          value={popular ? popular.name : "—"}
          hint={
            popular
              ? `${formatNumber(popular.workspaces)} live workspace${popular.workspaces === 1 ? "" : "s"}`
              : "No live workspaces yet"
          }
          icon={Crown}
          iconClassName="bg-amber-50 text-amber-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const tone = PLAN_TONES[index % PLAN_TONES.length];
          const PlanIcon = tone.icon;

          return (
            <section
              key={plan.id}
              className={cn(
                PLATFORM_CARD,
                "flex flex-col transition-shadow hover:shadow-[0_10px_28px_-12px_rgba(15,23,42,0.18)]",
                !plan.isActive && "bg-slate-50/60",
                popular?.id === plan.id && "border-brand-700/40!",
              )}
            >
              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      tone.tint,
                      !plan.isActive && "opacity-60",
                    )}
                  >
                    <PlanIcon
                      className="size-5"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg leading-tight font-bold tracking-tight text-foreground">
                      {plan.name}
                    </h2>
                    {!plan.isActive && (
                      <ToneBadge tone="muted">Deprecated</ToneBadge>
                    )}
                    {popular?.id === plan.id && (
                      <ToneBadge tone="teal">Most popular</ToneBadge>
                    )}
                  </div>
                </div>

                {plan.description && (
                  <p
                    className="line-clamp-2 min-h-10 text-sm leading-5 text-slate-500"
                    title={plan.description}
                  >
                    {plan.description}
                  </p>
                )}

                <p className="flex items-baseline gap-1.5">
                  <span className="text-[2rem] leading-none font-bold tracking-tight text-foreground tabular-nums">
                    {formatCurrency(plan.price)}
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    / month
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="Workspaces"
                    value={formatNumber(plan.workspaces)}
                  />
                  <Metric label="MRR" value={formatCurrency(plan.mrr)} />
                </div>
              </div>

              {/* Limits as three small columns, so the card stays short. */}
              <div className="grid grid-cols-3 divide-x divide-slate-100! border-t border-border py-3.5">
                <Fact
                  icon={Users}
                  label="Seats"
                  value={limitText(plan.seatLimit)}
                />
                <Fact
                  icon={Ticket}
                  label="Tickets"
                  value={limitText(plan.ticketLimit)}
                />
                <Fact
                  icon={HardDrive}
                  label="Storage"
                  value={storageText(plan.storageLimitMb)}
                />
              </div>

              <div className="flex items-center gap-2 border-t border-border px-5 py-3">
                <Button
                  variant="outline"
                  className="h-9 flex-1 gap-1.5 rounded-lg font-semibold shadow-none"
                  aria-label={`Edit ${plan.name} plan`}
                  onClick={() => setEditingId(plan.id)}
                >
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Button>
                {plan.price > 0 && (
                  <Button
                    variant="ghost"
                    className="h-9 gap-1.5 rounded-lg font-semibold text-slate-600 shadow-none hover:text-foreground"
                    aria-label={`${plan.isActive ? "Deprecate" : "Show"} ${plan.name} plan`}
                    onClick={() => setVisibilityId(plan.id)}
                  >
                    {plan.isActive ? (
                      <Archive className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                    {plan.isActive ? "Deprecate" : "Show"}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <PlanComparison plans={plans} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent
          onOpenAutoFocus={(event) => event.preventDefault()}
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl min-w-0 gap-3 overflow-x-hidden overflow-y-auto sm:max-w-xl",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {creating && <CreatePlanDialog onClose={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(changingVisibility)}
        onOpenChange={(open) => !open && setVisibilityId(null)}
      >
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg min-w-0 overflow-x-hidden overflow-y-auto sm:max-w-lg",
            TEAM_DIALOG_CONTENT,
          )}
        >
          {changingVisibility && (
            <PlanVisibilityDialog
              key={changingVisibility.id}
              plan={changingVisibility}
              onClose={() => setVisibilityId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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
