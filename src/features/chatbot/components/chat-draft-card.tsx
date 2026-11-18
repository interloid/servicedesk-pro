"use client";

import { CircleAlert, FilePlus2, Loader2, Pencil } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChatDraft } from "@/features/chatbot/chatbot";
import { submitRequestAction } from "@/features/portal/actions/portal.actions";
import { supportClosedCreatedMessage } from "@/features/portal/support-closed";

/**
 * A request the assistant drafted. Nothing exists until Confirm, which submits
 * it through the same action as the New request form.
 */
export function ChatDraftCard({
  slug,
  draft,
  onChange,
  onDiscard,
  onCreated,
}: {
  slug: string;
  draft: ChatDraft;
  onChange: (draft: ChatDraft) => void;
  onDiscard: () => void;
  onCreated: (
    number: number | null,
    subject: string,
    note: string | null,
  ) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(draft);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, startCreating] = useTransition();
  const subjectId = useId();
  const descriptionId = useId();

  function confirm() {
    setError(null);

    startCreating(async () => {
      try {
        const result = await submitRequestAction(slug, draft);

        if (!result.success) {
          const fieldMessage = Object.values(result.fieldErrors ?? {})[0]?.[0];
          setError(fieldMessage ?? result.message);
          if (fieldMessage) setEditing(true);
          return;
        }

        onCreated(
          result.data.number,
          draft.subject,
          result.data.closed
            ? supportClosedCreatedMessage(result.data.closed)
            : null,
        );
      } catch {
        setError(
          "We couldn't create your request. Check your connection and try again.",
        );
      }
    });
  }

  return (
    <div className="ml-9.5 animate-in overflow-hidden rounded-2xl border border-brand-accent/35 bg-background shadow-sm duration-200 fade-in slide-in-from-bottom-1">
      <div className="flex items-center gap-2 border-b bg-brand-accent/5 px-4 py-2.5">
        <FilePlus2 className="size-4 text-brand-ink" aria-hidden />
        <p className="text-sm font-semibold">New request</p>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Draft · not sent yet
        </span>
      </div>

      <div className="space-y-3 px-4 py-3 text-sm">
        {editing ? (
          <>
            <div className="space-y-1">
              <label
                htmlFor={subjectId}
                className="text-xs font-medium text-muted-foreground"
              >
                Subject
              </label>
              <Input
                id={subjectId}
                value={edit.subject}
                onChange={(event) =>
                  setEdit({ ...edit, subject: event.target.value })
                }
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={descriptionId}
                className="text-xs font-medium text-muted-foreground"
              >
                Description
              </label>
              <Textarea
                id={descriptionId}
                value={edit.description}
                onChange={(event) =>
                  setEdit({ ...edit, description: event.target.value })
                }
                className="max-h-56 min-h-24"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Subject
              </p>
              <p className="mt-0.5 font-semibold">{draft.subject}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Description
              </p>
              <p className="mt-0.5 max-h-48 overflow-y-auto overscroll-contain whitespace-pre-wrap text-foreground/85">
                {draft.description}
              </p>
            </div>
          </>
        )}

        {error ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-lg bg-destructive/5 px-2.5 py-2 text-destructive"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/20 px-4 py-2.5">
        {editing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEdit(draft);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!edit.subject.trim() || !edit.description.trim()}
              onClick={() => {
                onChange({
                  subject: edit.subject.trim(),
                  description: edit.description.trim(),
                });
                setEditing(false);
              }}
            >
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              disabled={isCreating}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              disabled={isCreating}
            >
              <Pencil /> Edit
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirm}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 className="animate-spin" /> : null}
              Confirm &amp; create
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
