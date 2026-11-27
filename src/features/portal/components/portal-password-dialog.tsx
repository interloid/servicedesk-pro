"use client";

import { useState } from "react";
import { CircleAlert, KeyRound, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TEAM_DIALOG_CONTENT } from "@/features/team/components/modal-buttons";
import {
  DIALOG_FOOTER_BAND,
  DialogIconHeader,
} from "@/features/team/components/dialog-icon-header";
import { Form } from "@/components/ui/form";
import { setPasswordAction } from "@/features/portal/actions/portal.actions";
import { PortalPasswordFields } from "@/features/portal/components/portal-password-fields";
import { applyFieldErrors } from "@/features/portal/form-errors";
import { portalToastSuccess } from "@/features/portal/portal-toast";
import {
  portalSetPasswordSchema,
  type PortalSetPasswordValues,
} from "@/features/portal/schemas/portal.schema";

/**
 * The customer changing their password, from the account menu.
 *
 * A sibling of the profile dialog rather than a part of it: the two are separate
 * things someone came to do, and a dialog that opens another dialog is a worse
 * experience than a flat list of what the account can do. It shares the profile
 * dialog's width, header and footer so the two read as one product.
 *
 * /portal/password still exists and is still the right place for a customer
 * arriving from a magic link: it carries the first-time framing and the Skip
 * escape, and it moves them on to wherever they were going. Neither half of that
 * belongs on someone already signed in who only came to change a password.
 */
export function PortalPasswordDialog({
  open,
  onOpenChange,
  tenantSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* As in the profile dialog: no hover wash on the cross. */}
      <DialogContent
        className={`max-h-[90dvh] gap-5 overflow-y-auto sm:max-w-md ${TEAM_DIALOG_CONTENT}`}
      >
        {/* Worded for both cases: an account that has only ever used email
            links is setting its first password here, not changing one. */}
        <DialogIconHeader
          icon={KeyRound}
          title="Change password"
          description="Set a new password to sign in with, instead of waiting for an email link."
        />

        {/* Its own component so its state lives only while the dialog is open:
            Radix unmounts the content on close, so every opening starts from
            empty fields rather than from an abandoned attempt. Same reason
            ProfileForm in the profile dialog is its own component. */}
        <PasswordForm
          tenantSlug={tenantSlug}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function PasswordForm({
  tenantSlug,
  onDone,
}: {
  tenantSlug: string;
  onDone: () => void;
}) {
  const [error, setError] = useState<string | undefined>();

  const form = useForm<PortalSetPasswordValues>({
    defaultValues: { password: "", confirmPassword: "" },
    resolver: zodResolver(portalSetPasswordSchema),
  });

  async function onSubmit(values: PortalSetPasswordValues) {
    setError(undefined);

    const result = await setPasswordAction(tenantSlug, values);

    if (result.success) {
      // Not the /portal/password page's "instead of waiting for an email":
      // from the menu this may be a change to an existing password, and that
      // wording would only be true for a first one.
      //
      // onDone rather than following the action's redirectTo. The page navigates
      // because there the password is a step on the way somewhere; here the
      // customer is already on the screen they came from, and navigating would
      // throw them out of it.
      portalToastSuccess("Password saved. Use it next time you sign in.");

      onDone();
      return;
    }

    applyFieldErrors(form, result.fieldErrors);
    setError(result.message);
  }

  return (
    <>
      {error ? (
        <Alert variant="destructive" className="rounded-[10px] px-3.5 py-3">
          <CircleAlert className="size-4.5" aria-hidden />
          <AlertDescription className="text-sm leading-[1.55]">
            {error}
          </AlertDescription>
        </Alert>
      ) : null}

      <Form {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <PortalPasswordFields control={form.control} />

          <div
            className={`-mx-5 -mb-5 mt-1 grid grid-cols-2 gap-3 border-t border-border p-5 sm:flex sm:justify-end ${DIALOG_FOOTER_BAND}`}
          >
            <Button
              type="button"
              variant="outline"
              disabled={form.formState.isSubmitting}
              onClick={onDone}
              className="h-11 px-5 text-sm font-semibold hover:bg-brand-accent/10 hover:text-brand-accent focus:bg-brand-accent/10 focus:text-brand-accent"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="h-11 px-5 text-sm font-semibold"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save password"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
