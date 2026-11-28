import { cn } from "@/lib/utils";

/**
 * A visual hint only. It does not validate: the account schema's 8-character
 * minimum is still the only rule enforced.
 */
function scorePassword(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;

  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  // Under the minimum length it can never read better than "Weak".
  if (password.length < 8) return 1;

  return Math.max(1, Math.min(4, checks - 1)) as 1 | 2 | 3 | 4;
}

const LEVELS = [
  { label: "", bar: "", text: "" },
  { label: "Weak", bar: "bg-red-500", text: "text-red-600" },
  { label: "Fair", bar: "bg-amber-500", text: "text-amber-600" },
  { label: "Good", bar: "bg-teal-500", text: "text-teal-700" },
  { label: "Strong", bar: "bg-brand-accent", text: "text-brand-accent" },
] as const;

export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);
  const level = LEVELS[score];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3, 4].map((segment) => (
          <span
            key={segment}
            className={cn(
              "h-1 flex-1 rounded-full bg-slate-200 transition-colors duration-300 motion-reduce:transition-none",
              segment <= score && level.bar,
            )}
          />
        ))}
      </div>
      <p className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Use 12+ characters with numbers and symbols.</span>
        <span
          aria-live="polite"
          className={cn("shrink-0 font-semibold", level.text)}
        >
          {level.label}
        </span>
      </p>
    </div>
  );
}
