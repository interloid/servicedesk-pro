/**
 * Shared presentation for the central sign-in and sign-up forms, so both
 * pages share one field, checkbox and primary-button treatment.
 *
 * Border colours, hover, focus, error and autofill states for `auth-field`,
 * `auth-checkbox` and `auth-social` live in globals.css, not here: a global
 * unlayered rule there overrides Tailwind's border-colour classes, so they
 * would silently do nothing. Keep only sizing and type in these strings.
 */
// text-sm at every width, like the rest of the form. iPhones get 16px from the
// guard in globals.css, since Safari zooms into any field under 16px on focus.
export const AUTH_FIELD_CLASS =
  "auth-field h-11 rounded-[10px] pl-3.5 text-sm text-foreground placeholder:text-slate-400";

export const AUTH_LABEL_CLASS = "text-sm font-semibold text-foreground";

/**
 * One column width (448px) for both pages, passed to AuthSplitShell, so the
 * sign-in and sign-up inputs are exactly the same width at every breakpoint.
 */
export const AUTH_COLUMN_CLASS = "max-w-md";

/**
 * The card around the form below `lg` (a borderless panel from `lg` up). Same
 * radius, shadow and padding on both pages, so inputs inset identically.
 */
export const AUTH_CARD_CLASS =
  "w-full max-w-none rounded-2xl border bg-card px-5 py-6 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:p-8 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none";

/**
 * Spacing scale for both forms: 6px from label to input and from input to its
 * helper / error text (overrides FormItem's default gap-2; don't add space-y on
 * top, it stacks with the grid gap), and 20px between one field and the next.
 */
export const AUTH_FIELD_ITEM_CLASS = "gap-1.5";
export const AUTH_FIELD_STACK_CLASS = "flex flex-col gap-5";

export const AUTH_CHECKBOX_CLASS = [
  "auth-checkbox size-4.5 rounded-[5px] bg-card shadow-xs",
  "data-[state=checked]:bg-brand-accent data-[state=checked]:text-brand-accent-foreground",
].join(" ");

/** Outline-style secondary button ("Continue with Google"). */
export const AUTH_SOCIAL_BUTTON_CLASS =
  "auth-social h-11 w-full gap-2.5 rounded-[10px] bg-card text-base font-medium text-foreground shadow-xs transition-[background-color,border-color] duration-150 hover:bg-slate-50 hover:text-foreground";

/** Hover lifts the button a pixel; the Button's own active state presses it back down. */
export const AUTH_PRIMARY_BUTTON_CLASS = [
  "h-11 w-full rounded-[10px] text-base font-semibold",
  "shadow-sm shadow-brand-accent/25",
  "transition-[background-color,box-shadow,transform] duration-150 ease-out",
  "hover:-translate-y-px hover:shadow-md hover:shadow-brand-accent/30",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
].join(" ");
