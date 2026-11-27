"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
} from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";

import { createSupportRequestAction } from "../support-actions";
import {
  SUPPORT_ACCESS_HOURS,
  SUPPORT_BODY_MAX,
  SUPPORT_SUBJECT_MAX,
} from "../support";

type Errors = Record<string, string[] | undefined>;

const LABEL_CLASS =
  "flex items-center gap-1 text-sm font-semibold text-foreground";

function RequiredMark() {
  return (
    <span aria-hidden className="text-destructive">
      *
    </span>
  );
}

/**
 * A titled group of fields, as on the platform settings form: the icon,
 * title and description on the left, the fields in a card on the right
 * (stacked on narrow screens).
 */
function FormSection({
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
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
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
      <div className={cn(DASHBOARD_CARD, "flex flex-col gap-5 p-5")}>
        {children}
      </div>
    </section>
  );
}

function FieldError({ errors, name }: { errors: Errors; name: string }) {
  const message = errors[name]?.[0];

  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function CreateSupportRequestForm({
  requestsHref,
  requestHref,
}: {
  /** Where Cancel goes. */
  requestsHref: string;
  /** The new request's page, given its id. */
  requestHref: string;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [allowAccess, setAllowAccess] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [isSending, startSending] = useTransition();

  function clear(name: string) {
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function submit() {
    startSending(async () => {
      try {
        const result = await createSupportRequestAction({
          subject,
          description,
          allowWorkspaceAccess: allowAccess,
        });

        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          toast.error("Couldn't send your request", {
            description: result.message,
          });
          return;
        }

        toast.success(`${result.data?.number ?? "Request"} sent`, {
          description: "Our support team will reply here.",
        });
        router.push(`${requestHref}/${result.data?.id ?? ""}`);
      } catch {
        toast.error("Couldn't send your request", {
          description: "Check your connection and try again.",
        });
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <FormSection
        icon={FileText}
        tint="bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100"
        title="Request details"
        description="What's wrong, in your own words."
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="support-subject" className={LABEL_CLASS}>
            Subject
            <RequiredMark />
          </Label>
          <Input
            id="support-subject"
            value={subject}
            maxLength={SUPPORT_SUBJECT_MAX}
            placeholder="e.g. Customers aren't receiving reply emails"
            autoFocus
            className="h-10 rounded-lg text-sm"
            aria-invalid={Boolean(errors.subject)}
            onChange={(event) => {
              setSubject(event.target.value);
              clear("subject");
            }}
          />
          <p className="text-xs text-slate-500">
            Write a short summary of the problem.
          </p>
          <FieldError errors={errors} name="subject" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="support-description" className={LABEL_CLASS}>
            Describe the problem
            <RequiredMark />
          </Label>
          <Textarea
            id="support-description"
            rows={8}
            value={description}
            maxLength={SUPPORT_BODY_MAX}
            placeholder="What happened, what you expected, and the steps to see it. Include ticket numbers or emails if they help."
            className="max-h-96 min-h-44 resize-y rounded-lg text-sm leading-6"
            aria-invalid={Boolean(errors.description)}
            onChange={(event) => {
              setDescription(event.target.value);
              clear("description");
            }}
          />
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs text-slate-500">
              Include any error messages, ticket numbers or steps to reproduce
              it.
            </p>
            <span
              aria-live="polite"
              className="shrink-0 text-xs text-slate-400 tabular-nums"
            >
              {description.length.toLocaleString("en-GB")}/
              {SUPPORT_BODY_MAX.toLocaleString("en-GB")}
            </span>
          </div>
          <FieldError errors={errors} name="description" />
        </div>
      </FormSection>

      <FormSection
        icon={ShieldCheck}
        tint="bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-300"
        title="Workspace access"
        description="Optional. Lets support look into the problem directly."
      >
        <label
          htmlFor="support-access"
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-muted/30",
            allowAccess &&
              "border-brand-700/40! bg-brand-700/5 hover:bg-brand-700/5",
          )}
        >
          <Checkbox
            id="support-access"
            checked={allowAccess}
            onCheckedChange={(checked) => setAllowAccess(checked === true)}
            className="mt-0.5"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              Allow support to access my workspace
            </span>
            <span className="text-sm leading-6 text-slate-500">
              For {SUPPORT_ACCESS_HOURS} hours, only for this request, our team
              can see your workspace and sign in as you to fix the problem, with
              your access. Everything they open or change is recorded in your
              audit log as platform support, and you can withdraw access at any
              time.
            </span>
          </span>
        </label>

        {allowAccess && (
          <ModalNotice icon={Eye} tone="neutral">
            <span className="text-xs leading-[1.55]">
              Access ends after {SUPPORT_ACCESS_HOURS} hours, or as soon as the
              request is resolved or closed.
            </span>
          </ModalNotice>
        )}
      </FormSection>

      <div
        className={cn(
          DASHBOARD_CARD,
          "flex flex-col-reverse gap-3 px-5 py-3.5 sm:flex-row sm:justify-end",
        )}
      >
        <Button
          asChild
          variant="outline"
          className={cn(
            DASHBOARD_BUTTON,
            "w-full bg-card hover:bg-slate-50 sm:w-auto dark:hover:bg-muted",
          )}
        >
          <Link href={requestsHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={isSending}
          className={cn(
            DASHBOARD_BUTTON,
            "w-full gap-2 bg-brand-accent px-5 text-brand-accent-foreground hover:bg-brand-accent/90 sm:w-auto",
          )}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          Send request
        </Button>
      </div>
    </form>
  );
}
