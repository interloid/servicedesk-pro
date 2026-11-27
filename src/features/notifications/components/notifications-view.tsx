"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AtSign,
  Bell,
  BellOff,
  Calendar,
  ChevronDown,
  CreditCard,
  ExternalLink,
  Filter,
  Mail,
  MailOpen,
  MessageSquare,
  MoreVertical,
  Reply,
  RotateCcw,
  Search,
  Settings2,
  Smartphone,
  Ticket,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
  DASHBOARD_ICON_BUTTON,
  DashboardPageHeader,
} from "@/components/shared/dashboard-ui";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";
import { cn } from "@/lib/utils";
import type {
  NotificationChannelKey,
  NotificationEventKey,
  NotificationFeedItem,
  NotificationFeedType,
  NotificationPrefs,
  NotificationsData,
} from "@/features/notifications/types/notifications";
import { useNotifications } from "@/features/notifications/components/notifications-provider";

interface PreferenceRow {
  id: NotificationEventKey;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: keyof typeof TONES;
}

const PREFERENCE_ROWS: PreferenceRow[] = [
  {
    id: "assigned",
    label: "A ticket is assigned to me",
    description: "Get notified when a ticket is assigned to you.",
    icon: Mail,
    tone: "teal",
  },
  {
    id: "replies",
    label: "A customer replies",
    description: "Get notified when a customer replies to a ticket.",
    icon: Reply,
    tone: "blue",
  },
  {
    id: "sla",
    label: "An SLA is about to breach",
    description: "Get notified before an SLA is about to breach.",
    icon: TriangleAlert,
    tone: "amber",
  },
  {
    id: "mention",
    label: "I'm @mentioned in a note",
    description: "Get notified when someone mentions you in a ticket note.",
    icon: AtSign,
    tone: "violet",
  },
  {
    id: "created",
    label: "A new ticket is raised",
    description:
      "Admins and managers: get notified of every new ticket, portal ones included.",
    icon: Ticket,
    tone: "slate",
  },
  {
    id: "reopened",
    label: "A ticket is reopened",
    description:
      "Get notified when a resolved or closed ticket is reopened. Goes to its assignee, or to admins and managers when nobody has it.",
    icon: RotateCcw,
    tone: "teal",
  },
];

const CHANNELS: {
  id: NotificationChannelKey;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "in_app", label: "In-app", icon: Smartphone },
];

const TYPE_FILTERS: { id: NotificationFeedType | "all"; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "ticket", label: "Tickets" },
  { id: "sla", label: "SLA" },
  { id: "reply", label: "Replies & mentions" },
  { id: "payment", label: "Billing" },
  { id: "system", label: "System" },
];

const DATE_FILTERS = [
  { id: "all", label: "All time", days: null },
  { id: "today", label: "Today", days: 0 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
] as const;

type DateFilter = (typeof DATE_FILTERS)[number]["id"];
type Tab = "all" | "unread" | "history";

const PAGE_SIZE = 7;

const TONES = {
  red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  blue: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400",
  teal: "bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  slate: "bg-slate-100 text-slate-500 dark:bg-muted dark:text-muted-foreground",
} as const;

/** The unread dot on a row's icon, in the icon's colour with a soft halo. */
const TONE_DOTS: Record<keyof typeof TONES, string> = {
  red: "bg-red-600 ring-red-500/20 dark:bg-red-400",
  amber: "bg-amber-500 ring-amber-500/25 dark:bg-amber-400",
  blue: "bg-sky-600 ring-sky-500/20 dark:bg-sky-400",
  teal: "bg-brand-700 ring-brand-700/20 dark:bg-brand-300",
  violet: "bg-violet-600 ring-violet-500/20 dark:bg-violet-400",
  slate: "bg-slate-500 ring-slate-500/20",
};

/**
 * Breaches are red and warnings amber; first-response clocks get the mail
 * icon in blue so they read apart from resolution clocks at a glance.
 */
function notificationIcon(item: NotificationFeedItem): {
  icon: LucideIcon;
  tone: keyof typeof TONES;
} {
  if (item.type === "sla") {
    if (item.slaType === "first_response") return { icon: Mail, tone: "blue" };
    return {
      icon: TriangleAlert,
      tone: item.kind === "sla_warning" ? "amber" : "red",
    };
  }

  switch (item.type) {
    case "ticket":
      return { icon: Ticket, tone: "teal" };
    case "reply":
      return { icon: MessageSquare, tone: "teal" };
    case "payment":
      return { icon: CreditCard, tone: "amber" };
    default:
      return { icon: Bell, tone: "slate" };
  }
}

function withinDate(iso: string, filter: DateFilter): boolean {
  const days = DATE_FILTERS.find((d) => d.id === filter)?.days ?? null;
  if (days === null) return true;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return new Date(iso).getTime() >= start.getTime();
}

function IconBadge({
  icon: Icon,
  tone,
  className,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        TONES[tone],
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </div>
  );
}

function FilterMenu<T extends string>({
  icon: Icon,
  value,
  options,
  onChange,
  label,
}: {
  icon: LucideIcon;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          className="h-10 flex-1 justify-between gap-2 rounded-lg bg-card px-3 text-sm font-medium shadow-none hover:bg-slate-50 sm:flex-none dark:hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <Icon className="size-4 text-slate-400" />
            {current.label}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as T)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.id}
              value={option.id}
              className="cursor-pointer p-2 text-sm"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center text-sm text-slate-500">
      <IconBadge
        icon={Icon}
        tone="slate"
        className="size-11 bg-slate-100 text-slate-400"
      />
      {children}
    </div>
  );
}

interface NotificationsViewProps {
  data: NotificationsData;
}

export default function NotificationsView({ data }: NotificationsViewProps) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const live = useNotifications();
  const { hydrate } = live;
  // The shared feed stays live over realtime; the server's copy covers the
  // first paint until it has loaded.
  const prefs = live.prefs ?? data.prefs;
  const notifications = live.notifications ?? data.notifications;

  useEffect(() => {
    hydrate({ prefs: data.prefs, notifications: data.notifications });
  }, [data.prefs, data.notifications, hydrate]);
  const [tab, setTab] = useState<Tab>("all");
  const [term, setTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotificationFeedType | "all">(
    "all",
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => n.unread).length;

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();

    return notifications.filter(
      (n) =>
        (tab !== "unread" || n.unread) &&
        (typeFilter === "all" || n.type === typeFilter) &&
        withinDate(n.createdAt, dateFilter) &&
        (!needle ||
          n.title.toLowerCase().includes(needle) ||
          n.subtitle.toLowerCase().includes(needle)),
    );
  }, [notifications, tab, term, typeFilter, dateFilter]);

  const history = useMemo(() => {
    const needle = term.trim().toLowerCase();

    return data.history.filter((change) => {
      const row = PREFERENCE_ROWS.find((r) => r.id === change.event);
      return (
        withinDate(change.createdAt, dateFilter) &&
        (!needle || row?.label.toLowerCase().includes(needle))
      );
    });
  }, [data.history, term, dateFilter]);

  const total = tab === "history" ? history.length : filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const pageHistory = history.slice(start, start + PAGE_SIZE);

  // Any change to what's listed starts again from the first page.
  const resetPage =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const togglePreference = (
    id: NotificationEventKey,
    channel: NotificationChannelKey,
  ) => {
    const nextPrefs: NotificationPrefs = {
      ...prefs,
      [channel]: { ...prefs[channel], [id]: !prefs[channel][id] },
    };
    startTransition(async () => {
      await live.savePrefs(nextPrefs);
    });
  };

  const markAllRead = () => {
    startTransition(async () => {
      await live.markAllRead();
    });
  };

  const setRead = (id: string, read: boolean) => {
    if (!notifications.some((n) => n.id === id && n.unread === read)) return;
    startTransition(async () => {
      await live.setRead(id, read);
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await live.remove(id);
    });
  };

  const ticketHref = (item: NotificationFeedItem) =>
    item.ticketId
      ? tenantPath(tenantSlug, `${TENANT_ROUTES.TICKETS}/${item.ticketId}`)
      : null;

  const openItem = (item: NotificationFeedItem) => {
    setRead(item.id, true);
    const href = ticketHref(item);
    if (href) router.push(href);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "All notifications" },
    { id: "unread", label: `Unread (${unreadCount})` },
    { id: "history", label: "Settings history" },
  ];

  return (
    // From lg the page is exactly the window's height and never scrolls, like
    // the Audit log: the header, the preferences (shown in full, never
    // scrolled) and the list's toolbar and pagination keep their size, and
    // only the list scrolls in what is left. Below lg there is no room for
    // that, so the page scrolls as usual.
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:overflow-hidden lg:p-8">
      <div className="mx-auto space-y-4 sm:space-y-6 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-0 lg:gap-6">
        <div className="shrink-0">
          <DashboardPageHeader
            eyebrow="Settings"
            icon={Bell}
            title="Notifications"
            description="Manage how you receive alerts. Configure email and in-app notifications for important events."
            action={
              <Button
                variant="outline"
                onClick={markAllRead}
                disabled={isPending || unreadCount === 0}
                className={cn(
                  DASHBOARD_BUTTON,
                  "w-full gap-2 bg-card text-sm hover:bg-slate-50 sm:w-auto dark:hover:bg-muted",
                )}
              >
                <MailOpen className="size-4" />
                Mark all as read
              </Button>
            }
          />
        </div>

        <section
          className={cn(
            DASHBOARD_CARD,
            "flex flex-col gap-4 p-4 sm:p-5 lg:shrink-0",
          )}
        >
          {/* Same column gap and right inset (px-3 + 1px border) as the rows
              below, so the channel headings sit centred over their switches. */}
          <div className="grid grid-cols-1 items-end gap-x-3 gap-y-1 sm:pr-3.25 sm:grid-cols-[minmax(0,1fr)_112px_112px] lg:grid-cols-[minmax(0,1fr)_160px_160px]">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-700/20 dark:text-brand-100">
                <Settings2
                  className="size-4.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              <div className="min-w-0 space-y-0.5">
                <h2 className="font-heading text-base leading-snug font-bold tracking-tight text-foreground">
                  Notification preferences
                </h2>
                <p className="text-xs text-slate-500">
                  Choose which events you want to be notified about via email
                  and in-app.
                </p>
              </div>
            </div>
            {CHANNELS.map((c) => (
              <span
                key={c.id}
                className="hidden items-center justify-center gap-1.5 pb-0.5 text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase sm:flex"
              >
                <c.icon className="size-3.5" />
                {c.label}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {PREFERENCE_ROWS.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-2 items-center gap-x-3 gap-y-3 rounded-lg border border-border px-3 py-3 transition-colors hover:bg-slate-50/60 sm:grid-cols-[minmax(0,1fr)_112px_112px] sm:gap-y-0 sm:py-2.5 lg:grid-cols-[minmax(0,1fr)_160px_160px] dark:hover:bg-muted/30"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1 sm:gap-4">
                  <IconBadge
                    icon={row.icon}
                    tone={row.tone}
                    className="rounded-lg"
                  />
                  <div className="min-w-0 sm:pl-2">
                    <p className="text-sm font-semibold text-foreground">
                      {row.label}
                    </p>
                    <p className="text-xs text-slate-500">{row.description}</p>
                  </div>
                </div>
                {CHANNELS.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 sm:justify-center sm:bg-transparent sm:p-0 dark:bg-muted/50"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:hidden">
                      <channel.icon className="size-3.5" />
                      {channel.label}
                    </span>
                    <Switch
                      checked={prefs[channel.id][row.id]}
                      disabled={isPending}
                      onCheckedChange={() =>
                        togglePreference(row.id, channel.id)
                      }
                      aria-label={`${row.label} — ${channel.label}`}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section
          className={cn(
            DASHBOARD_CARD,
            "flex flex-col overflow-hidden lg:min-h-0",
          )}
        >
          <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3 xl:flex-row xl:items-center xl:justify-between">
            <div
              role="tablist"
              aria-label="Notifications"
              className="flex h-10 w-fit max-w-full shrink-0 items-center gap-1 overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-slate-100/70 p-1 scrollbar-none dark:bg-muted/50"
            >
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => resetPage(setTab)(t.id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    tab === t.id
                      ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 dark:bg-card dark:ring-border"
                      : "text-slate-500 hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:flex-1 xl:w-64 xl:flex-none">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  value={term}
                  onChange={(event) => resetPage(setTerm)(event.target.value)}
                  placeholder="Search notifications..."
                  aria-label="Search notifications"
                  maxLength={200}
                  className="h-10 rounded-lg bg-card pl-9 text-sm"
                />
              </div>
              <div className="flex gap-2 sm:shrink-0">
                {tab !== "history" && (
                  <FilterMenu
                    icon={Filter}
                    label="Filter by type"
                    value={typeFilter}
                    options={TYPE_FILTERS}
                    onChange={resetPage(setTypeFilter)}
                  />
                )}
                <FilterMenu
                  icon={Calendar}
                  label="Filter by date"
                  value={dateFilter}
                  options={DATE_FILTERS}
                  onChange={resetPage(setDateFilter)}
                />
              </div>
            </div>
          </div>

          {/* The one part of the page that scrolls, from lg. */}
          <div className="lg:min-h-0 lg:overflow-y-auto">
            {tab === "history" ? (
              pageHistory.length === 0 ? (
                <EmptyState icon={Settings2}>
                  No preference changes to show.
                </EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {pageHistory.map((change) => {
                    const row = PREFERENCE_ROWS.find(
                      (r) => r.id === change.event,
                    );
                    const channel = CHANNELS.find(
                      (c) => c.id === change.channel,
                    );
                    return (
                      <li
                        key={change.id}
                        className="flex items-start gap-3 px-4 py-3 sm:items-center sm:px-5"
                      >
                        <IconBadge
                          icon={change.enabled ? Bell : BellOff}
                          tone={change.enabled ? "teal" : "slate"}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {channel?.label} {change.enabled ? "on" : "off"} for
                            “{row?.label}”
                          </p>
                          <p className="text-xs text-slate-500">
                            You turned {change.enabled ? "on" : "off"}{" "}
                            {channel?.label.toLowerCase()} notifications for
                            this event.
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
                          {change.time}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : pageItems.length === 0 ? (
              <EmptyState icon={Bell}>
                {notifications.length === 0
                  ? "No notifications yet. Ticket assignments and SLA alerts will show up here."
                  : tab === "unread" && unreadCount === 0
                    ? "You're all caught up."
                    : "No notifications match your filters."}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {pageItems.map((item) => {
                  const { icon, tone } = notificationIcon(item);
                  const href = ticketHref(item);
                  return (
                    <li
                      key={item.id}
                      className="group relative flex items-center gap-2 pr-3 transition-colors hover:bg-slate-50/60 sm:pr-4 dark:hover:bg-muted/30"
                    >
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left sm:pl-5"
                      >
                        <span className="relative shrink-0">
                          <IconBadge icon={icon} tone={tone} />
                          {item.unread && (
                            <span
                              aria-label="Unread"
                              className="absolute -top-0.5 -right-0.5 flex size-2.5"
                            >
                              {/* Blinking halo; still for reduced motion. */}
                              <span
                                aria-hidden
                                className={cn(
                                  "absolute inset-0 animate-ping rounded-full opacity-75 motion-reduce:hidden",
                                  TONE_DOTS[tone],
                                )}
                              />
                              <span
                                className={cn(
                                  "relative size-2.5 rounded-full ring-4",
                                  TONE_DOTS[tone],
                                )}
                              />
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-sm text-foreground",
                              item.unread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="truncate text-xs text-slate-500">
                              {item.subtitle}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 tabular-nums md:hidden">
                            {item.time}
                          </p>
                        </div>
                        <span className="hidden w-32 shrink-0 text-xs text-slate-500 tabular-nums md:block">
                          {item.time}
                        </span>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className={cn(
                              DASHBOARD_ICON_BUTTON,
                              "shrink-0 text-slate-500 hover:bg-slate-50 hover:text-foreground dark:hover:bg-muted",
                            )}
                            aria-label={`Actions for ${item.title}`}
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {href && (
                            <DropdownMenuItem
                              asChild
                              className="cursor-pointer p-2"
                            >
                              <Link
                                href={href}
                                onClick={() => setRead(item.id, true)}
                              >
                                <ExternalLink />
                                Open ticket
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="cursor-pointer p-2"
                            disabled={isPending}
                            onSelect={() => setRead(item.id, item.unread)}
                          >
                            {item.unread ? <MailOpen /> : <Mail />}
                            {item.unread ? "Mark as read" : "Mark as unread"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer p-2"
                            variant="destructive"
                            disabled={isPending}
                            onSelect={() => remove(item.id)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {total > 0 && (
            <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-4 py-3 sm:flex-row dark:bg-muted/20">
              <p className="text-sm text-slate-500 tabular-nums">
                Showing {start + 1} - {Math.min(start + PAGE_SIZE, total)} of{" "}
                {total} {tab === "history" ? "changes" : "notifications"}
              </p>
              {pageCount > 1 && (
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                  label="Notifications pages"
                />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
