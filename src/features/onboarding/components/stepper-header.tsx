import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface StepperHeaderProps {
  currentStep: number;
}

// All five wizard steps, so the stepper always agrees with "STEP n OF 5".
const steps = [
  { id: 1, label: "Account" },
  { id: 2, label: "Organization" },
  { id: 3, label: "Business hours" },
  { id: 4, label: "SLA policy" },
  { id: 5, label: "Invite team" },
];

export function StepperHeader({ currentStep }: StepperHeaderProps) {
  const activeStep = steps.find((step) => step.id === currentStep) ?? steps[0];

  return (
    <div className="w-full">
      <ol aria-label="Setup progress" className="grid grid-cols-5">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <li
              key={step.id}
              aria-current={isActive ? "step" : undefined}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              {/* Connector to the next step; fills once this step is done. */}
              {!isLast && (
                <span
                  aria-hidden
                  className="absolute top-3.5 right-[calc(-50%+1.125rem)] left-[calc(50%+1.125rem)] h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200"
                >
                  <span
                    className={cn(
                      "block h-full origin-left rounded-full bg-brand-accent transition-transform duration-500 ease-out motion-reduce:transition-none",
                      isCompleted ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </span>
              )}

              <span
                className={cn(
                  "relative flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 motion-reduce:transition-none",
                  isCompleted && "bg-brand-accent text-brand-accent-foreground",
                  isActive &&
                    "bg-brand-accent text-brand-accent-foreground shadow-sm ring-4 ring-brand-accent/15",
                  !isActive &&
                    !isCompleted &&
                    "border border-slate-300 bg-card text-slate-500",
                )}
              >
                {isCompleted ? (
                  <Check className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  step.id
                )}
              </span>

              <span
                className={cn(
                  "sr-only text-[11px] leading-tight font-semibold transition-colors sm:not-sr-only",
                  isActive
                    ? "text-foreground"
                    : isCompleted
                      ? "text-slate-600"
                      : "text-slate-400",
                )}
              >
                {step.label}
                {isCompleted && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <p
        aria-hidden
        className="mt-3 text-center text-xs font-semibold text-foreground sm:hidden"
      >
        {activeStep.label}
      </p>
    </div>
  );
}
