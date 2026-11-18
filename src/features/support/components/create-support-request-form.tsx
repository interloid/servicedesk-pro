"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { ModalNotice } from "@/components/shared/modal-notice";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
          toast.error(result.message);
          return;
        }

        toast.success(
          `${result.data?.number ?? "Request"} sent. Our support team will reply here.`,
        );
        router.push(`${requestHref}/${result.data?.id ?? ""}`);
      } catch {
        toast.error("We couldn't send your request. Check your connection.");
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-6 rounded-2xl border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_rgba(15,23,42,0.05)] sm:p-7"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
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
          className="h-11 rounded-lg bg-background/60 text-sm"
          aria-invalid={Boolean(errors.subject)}
          onChange={(event) => {
            setSubject(event.target.value);
            clear("subject");
          }}
        />
        <p className="text-xs text-muted-foreground">
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
          className="min-h-44 max-h-96 resize-y rounded-lg bg-background/60 text-sm leading-6"
          aria-invalid={Boolean(errors.description)}
          onChange={(event) => {
            setDescription(event.target.value);
            clear("description");
          }}
        />
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Include any error messages, ticket numbers or steps to reproduce it.
          </p>
          <span
            aria-live="polite"
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
          >
            {description.length.toLocaleString("en-GB")}/
            {SUPPORT_BODY_MAX.toLocaleString("en-GB")}
          </span>
        </div>
        <FieldError errors={errors} name="description" />
      </div>

      <label
        htmlFor="support-access"
        className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
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
          <span className="text-sm leading-6 text-muted-foreground">
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

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button
          asChild
          variant="outline"
          className="h-11 w-full rounded-lg px-5 font-semibold shadow-none sm:w-auto"
        >
          <Link href={requestsHref}>Cancel</Link>
        </Button>
        <Button
          type="submit"
          disabled={isSending}
          className="h-11 w-full gap-2 rounded-lg bg-brand-accent px-5 font-semibold text-brand-accent-foreground shadow-none hover:bg-brand-accent/90 sm:w-auto"
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
