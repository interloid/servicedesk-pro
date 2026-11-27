import { Skeleton } from "@/components/ui/skeleton";
import { AuthSplitShell } from "@/features/auth/components/auth-card";
import { AuthShowcase } from "@/features/auth/components/auth-showcase";
import {
  AUTH_CARD_CLASS,
  AUTH_COLUMN_CLASS,
  AUTH_FIELD_STACK_CLASS,
} from "@/features/auth/components/auth-styles";
import { cn } from "@/lib/utils";

/**
 * Without this file the wizard has no fallback while getTimezones runs, and
 * the page jumps when the card lands.
 *
 * It renders the page's real frame: the same AuthSplitShell, so the logo sits
 * where the page puts it, and the real AuthShowcase panel, which needs no data,
 * so the right half doesn't change at all when the page arrives. Only the
 * wizard card is drawn as placeholders, mirroring step 1 at the same sizes:
 * the shared card style and column width, the step eyebrow, heading and lead,
 * the five-step stepper (circles and connectors; labels from sm, the active
 * label underneath on a phone), then the three fields at the forms' spacing
 * (6px label to input, 20px between fields), the email hint, the password
 * strength bars, the terms checkbox, the Continue button, the "or" rule and
 * the "Already have an account?" line.
 *
 * Steps 2 to 5 are not drawn. The skeleton cannot know which one the customer
 * is on, and step 1 is where a first-time visitor always starts.
 *
 * Keep this in step with onboarding-wizard.tsx, stepper-header.tsx and
 * account.tsx when their layout changes.
 */

// Border colours set inline: the unlayered `* { border-border }` rule in
// globals.css overrides Tailwind's border-colour classes.
const FIELD_BORDER = { borderColor: "var(--input)" };
const CHECKBOX_BORDER = { borderColor: "#94a3b8" };

const FIELDS = [
  { key: "name", label: "w-20" },
  { key: "email", label: "w-12", hint: true },
  { key: "password", label: "w-18", strength: true },
];

export default function Loading() {
  return (
    <AuthSplitShell
      showcase={<AuthShowcase variant="signup" />}
      contentClassName={AUTH_COLUMN_CLASS}
    >
      <div
        role="status"
        aria-label="Loading account setup"
        className={cn(AUTH_CARD_CLASS, "flex flex-col text-left")}
      >
        {/* Step header: eyebrow, heading, lead, stepper. */}
        <div
          aria-hidden
          className="-mt-3 shrink-0 border-b border-slate-100 pt-3 pb-4"
        >
          <div className="flex h-6 items-center">
            <Skeleton className="h-3 w-20 bg-slate-200/80" />
          </div>
          <div className="mt-1 flex h-7 items-center sm:h-8">
            <Skeleton className="h-6 w-52 sm:h-7" />
          </div>
          <div className="mt-1 flex h-5 items-center">
            <Skeleton className="h-3.5 w-80 max-w-full" />
          </div>

          <div className="mt-4">
            <ol className="grid grid-cols-5">
              {[1, 2, 3, 4, 5].map((step) => (
                <li
                  key={step}
                  className="relative flex flex-col items-center gap-2"
                >
                  {step < 5 && (
                    <span className="absolute top-3.5 right-[calc(-50%+1.125rem)] left-[calc(50%+1.125rem)] h-0.5 -translate-y-1/2 rounded-full bg-slate-200" />
                  )}
                  <Skeleton
                    className={cn(
                      "size-7 rounded-full",
                      step === 1
                        ? "bg-slate-300/80 ring-4 ring-slate-100"
                        : "bg-slate-200/80",
                    )}
                  />
                  <div className="hidden h-3.5 items-center sm:flex">
                    <Skeleton className="h-2.5 w-14" />
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex h-4 items-center justify-center sm:hidden">
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>

        {/* Step 1 body. */}
        <div aria-hidden className="flex-1 pt-6">
          <div className="pb-4">
            <div className="w-full space-y-6">
              <div className={AUTH_FIELD_STACK_CLASS}>
                {FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <div className="flex h-5 items-center">
                      <Skeleton className={cn("h-3.5", field.label)} />
                    </div>
                    <div
                      className="h-11 w-full rounded-[10px] border bg-card shadow-xs"
                      style={FIELD_BORDER}
                    />
                    {field.hint && (
                      <div className="flex h-4 items-center">
                        <Skeleton className="h-3 w-60 max-w-full" />
                      </div>
                    )}
                    {field.strength && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4].map((segment) => (
                            <span
                              key={segment}
                              className="h-1 flex-1 rounded-full bg-slate-200"
                            />
                          ))}
                        </div>
                        <div className="flex h-4 items-center">
                          <Skeleton className="h-3 w-56 max-w-full" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex h-5 items-center gap-2.5">
                  <span
                    className="size-4.5 shrink-0 rounded-[5px] border bg-card shadow-xs"
                    style={CHECKBOX_BORDER}
                  />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </div>

                <div className="h-11 w-full rounded-[10px] bg-slate-300/70" />
              </div>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative bg-card px-3 text-xs text-slate-400">
                  or
                </div>
              </div>

              <div className="flex h-5 items-center justify-center">
                <Skeleton className="h-3.5 w-56" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthSplitShell>
  );
}
