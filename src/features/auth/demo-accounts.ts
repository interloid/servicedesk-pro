import {
  Headset,
  LifeBuoy,
  ShieldCheck,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * One-click demo sign-ins for the demo page (/login/demo), shown only when
 * demo mode is on (NEXT_PUBLIC_DEMO_LOGINS=true) and a demo password is set. These are the
 * throwaway accounts scripts/seed-tenants.mjs creates (the same ones the e2e
 * suite uses, see e2e/support/accounts.ts). NEXT_PUBLIC_* values ship to the
 * browser, so never turn this on for a site with real accounts.
 *
 * Every role signs in on the same form; the server sends each account to its
 * workspace, its support portal (customers) or the platform console.
 */

export type DemoAccount = {
  role: string;
  description: string;
  /** What this role is responsible for, as short lines for its card. */
  responsibilities: string[];
  /** Where the account lands after signing in. */
  landsOn: string;
  email: string;
  password: string;
  icon: LucideIcon;
  /** Icon circle colours. */
  tint: string;
};

// Read as literals so Next.js can inline them into the browser bundle.
const ENABLED = process.env.NEXT_PUBLIC_DEMO_LOGINS === "true";
const PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";
const PLATFORM_EMAIL = process.env.NEXT_PUBLIC_DEMO_PLATFORM_EMAIL ?? "";
const PLATFORM_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PLATFORM_PASSWORD ?? "";

function buildAccounts(): DemoAccount[] {
  if (!ENABLED || !PASSWORD) return [];

  const accounts: DemoAccount[] = [
    {
      role: "Tenant Admin",
      description: "Runs the workspace: team, settings and billing",
      responsibilities: [
        "Invite people and set their roles and permissions",
        "Set up branding, notifications and the audit log",
        "Manage the plan, seats and billing",
      ],
      landsOn: "The ticket queue",
      email: "nicole.sanders@cedarhealthgroup.com",
      password: PASSWORD,
      icon: ShieldCheck,
      tint: "bg-brand-50 text-brand-700",
    },
    {
      role: "Manager",
      description: "Oversees the queue, SLAs and the team",
      responsibilities: [
        "Watch the whole queue and reassign tickets",
        "Set SLA targets and business hours",
        "Review team performance in reports",
      ],
      landsOn: "The ticket queue",
      email: "emily.johnson@juniperridgeenergy.com",
      password: PASSWORD,
      icon: UsersRound,
      tint: "bg-violet-50 text-violet-600",
    },
    {
      role: "Agent",
      description: "Works tickets and replies to customers",
      responsibilities: [
        "Pick up, reply to and resolve tickets",
        "Keep each ticket inside its SLA target",
        "Save the ticket views you use most",
      ],
      landsOn: "The ticket queue",
      email: "stephanie.mitchell@cedarhealthgroup.com",
      password: PASSWORD,
      icon: Headset,
      tint: "bg-sky-50 text-sky-600",
    },
    {
      role: "Customer",
      description: "Raises and tracks requests in the portal",
      responsibilities: [
        "Raise a request and attach files",
        "Follow replies and answer the team",
        "Search the help centre or ask the assistant",
      ],
      landsOn: "The customer support portal",
      email: "dana.whitfield@northfieldclinic.com",
      password: PASSWORD,
      icon: LifeBuoy,
      tint: "bg-amber-50 text-amber-600",
    },
  ];

  if (PLATFORM_EMAIL && PLATFORM_PASSWORD) {
    accounts.push({
      role: "Platform Admin",
      description: "Manages every workspace, plan and billing",
      responsibilities: [
        "See every workspace, its plan and its usage",
        "Create plans and manage subscriptions",
        "Block a workspace, or sign in as one to give support",
      ],
      landsOn: "The platform console",
      email: PLATFORM_EMAIL,
      password: PLATFORM_PASSWORD,
      icon: UserCog,
      tint: "bg-slate-100 text-slate-700",
    });
  }

  return accounts;
}

export const DEMO_ACCOUNTS: DemoAccount[] = buildAccounts();

/** True when the demo page has at least one account to offer. */
export const DEMO_LOGIN_ENABLED = DEMO_ACCOUNTS.length > 0;
