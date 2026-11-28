import {
  Headset,
  LifeBuoy,
  ShieldCheck,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * One-click demo sign-ins for the login page, shown only when demo mode is on
 * (NEXT_PUBLIC_DEMO_LOGINS=true) and a demo password is set. These are the
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
  /** A few words for the role tile. */
  summary: string;
  /** The hover card on the tile: who this person is in the product. */
  details: {
    /** The demo organisation the account belongs to. */
    org: string;
    /** One sentence on what the role is for. */
    purpose: string;
    /** What they can see and do, 3 or 4 short lines. */
    can: string[];
    /** What the role does not reach, if worth saying. */
    cannot?: string;
    /** The screen the account opens on after sign-in. */
    landsOn: string;
  };
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
      summary: "Team, settings, billing",
      details: {
        org: "Cedar Health Group",
        purpose:
          "Owns the workspace: sets it up, manages the people in it and looks after the subscription.",
        can: [
          "Every ticket, customer, SLA policy and report",
          "Invite the team and assign roles",
          "Branding, channels, integrations and security",
          "Billing, plans and the audit log",
        ],
        landsOn: "the ticket queue",
      },
      email: "nicole.sanders@cedarhealthgroup.com",
      password: PASSWORD,
      icon: ShieldCheck,
      tint: "bg-brand-50 text-brand-700",
    },
    {
      role: "Manager",
      description: "Oversees the queue, SLAs and the team",
      summary: "Queue, SLAs, reports",
      details: {
        org: "Juniper Ridge Energy",
        purpose:
          "Leads the support team day to day, keeping the queue moving and response targets on track.",
        can: [
          "Assign and follow every ticket in the queue",
          "SLA policies, saved views and reports",
          "Manage the team, roles and branding",
          "Review the audit log",
        ],
        cannot: "No access to billing or security settings",
        landsOn: "the ticket queue",
      },
      email: "emily.johnson@juniperridgeenergy.com",
      password: PASSWORD,
      icon: UsersRound,
      tint: "bg-violet-50 text-violet-600",
    },
    {
      role: "Agent",
      description: "Works tickets and replies to customers",
      summary: "Works the tickets",
      details: {
        org: "Cedar Health Group",
        purpose:
          "Front-line support: picks up tickets, replies to customers and resolves their issues.",
        can: [
          "Work, reply to and resolve tickets",
          "Saved views and customer history",
          "Knowledge base, macros and templates",
          "SLA timers and team reports",
        ],
        cannot: "Cannot change the team or workspace settings",
        landsOn: "the ticket queue",
      },
      email: "stephanie.mitchell@cedarhealthgroup.com",
      password: PASSWORD,
      icon: Headset,
      tint: "bg-sky-50 text-sky-600",
    },
    {
      role: "Customer",
      description: "Raises and tracks requests in the portal",
      summary: "Support portal",
      details: {
        org: "Northfield Clinic, a customer of Cedar Health Group",
        purpose:
          "The person asking for help, using the company's branded support portal rather than the agent workspace.",
        can: [
          "Submit requests with attachments",
          "Track progress and reply to the team",
          "Help centre articles and the chat assistant",
          "Profile and password settings",
        ],
        cannot: "Sees only their own requests",
        landsOn: "the support portal",
      },
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
      summary: "All workspaces",
      details: {
        org: "ServiceDeskPro operations",
        purpose:
          "Runs the platform itself, across every customer workspace rather than inside one.",
        can: [
          "Overview, analytics and system health",
          "Every workspace, its users and roles",
          "Plans and platform billing",
          "Audit logs, system logs and settings",
        ],
        landsOn: "the platform console",
      },
      email: PLATFORM_EMAIL,
      password: PLATFORM_PASSWORD,
      icon: UserCog,
      tint: "bg-slate-100 text-slate-700",
    });
  }

  return accounts;
}

export const DEMO_ACCOUNTS: DemoAccount[] = buildAccounts();
