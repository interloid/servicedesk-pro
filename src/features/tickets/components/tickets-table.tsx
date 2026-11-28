"use client";

import {
  Suspense,
  useTransition,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  BrushCleaning,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Columns,
  Flag,
  Loader2,
  Ticket as TicketIcon,
  UserRound,
} from "lucide-react";
import {
  DASHBOARD_BUTTON,
  DASHBOARD_CARD,
} from "@/components/shared/dashboard-ui";
import { cn } from "@/lib/utils";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import CreateTicketSheet from "./create-ticket-sheet";
import {
  NO_SLA_TEXT,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  Ticket,
  TicketPriority,
  TicketStatus,
  isPriorityLowered,
} from "../types/tickets.types";
import { PriorityConfirmDialog } from "./priority-confirm-dialog";
import { toast } from "sonner";
import {
  bulkAssignToMeAction,
  bulkMarkSolvedAction,
  bulkSetPriorityAction,
} from "../actions/tickets.actions";
import Link from "next/link";
import { TicketsEmptyState } from "./ticket-empty";
import { useRealtimeTicketsRefresh } from "@/hooks/use-realtime-tickets-refresh";
import { LiveSla, computeLiveSla } from "../lib/sla";
import { TICKET_PAGE_SIZES } from "../lib/list";
import type { SavedViewTab } from "@/features/saved-view/filters";
import { TicketViewTabs, TicketViewTabsSkeleton } from "./ticket-view-tabs";
import { useNow } from "@/hooks/use-now";
import { useMounted } from "@/hooks/use-mounted";
import { TENANT_ROUTES, tenantPath } from "@/lib/tenancy";

interface TicketsTableProps {
  initialTickets: Ticket[];
  totalCount: number;
  /**
   * The viewer's saved views, in their Views page order, still loading: the
   * tab bar streams in on its own. Empty when they couldn't be loaded: an
   * "All tickets" tab shows instead.
   */
  viewTabs?: Promise<SavedViewTab[]>;
  tenant: string;
  /** False for tenant admins: tickets go to agents and managers. */
  canAssignToSelf?: boolean;
  /** The page and page size the server loaded, already clamped. */
  page?: number;
  limit?: number;
}

const NO_VIEW_TABS: Promise<SavedViewTab[]> = Promise.resolve([]);

/** The bulk bar's white action buttons; each adds its own hover tint. */
const BULK_ACTION_BUTTON =
  "h-10 gap-2 rounded-lg border-slate-200! bg-white px-4 text-sm font-semibold text-slate-800 shadow-none transition-colors hover:bg-slate-50 hover:text-foreground dark:border-border! dark:bg-card dark:text-foreground dark:hover:bg-muted";

/** The table's header cells, as on the platform tables. */
const TH =
  "h-10 overflow-hidden px-3 text-left text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-slate-500 uppercase";

/** A soft tinted pill with a hairline ring in the same hue. */
const PILL =
  "h-6 gap-1.5 rounded-md border-none px-2 text-xs font-semibold ring-1 ring-inset";

type ColumnKey =
  "id" | "subject" | "requester" | "priority" | "assignee" | "status" | "sla";

const TONE = {
  red: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-950/60 dark:text-red-300",
  amber:
    "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-950/60 dark:text-sky-300",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-950/60 dark:text-teal-300",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-950/60 dark:text-violet-300",
  green:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300",
  muted: "bg-slate-100 text-slate-600 ring-slate-500/15",
} as const;

const PRIORITY_STYLES: Record<string, { badge: string; dot: string }> = {
  urgent: { badge: TONE.red, dot: "bg-red-500" },
  high: { badge: TONE.amber, dot: "bg-amber-500" },
  normal: { badge: TONE.sky, dot: "bg-sky-500" },
  low: { badge: TONE.muted, dot: "bg-slate-400" },
};

const STATUS_BADGE: Record<TicketStatus, string> = {
  new: TONE.teal,
  open: TONE.sky,
  pending: TONE.amber,
  on_hold: TONE.violet,
  resolved: TONE.green,
  closed: TONE.muted,
};

const SLA_PILL: Record<LiveSla["type"], { pill: string; dot: string }> = {
  breached: { pill: TONE.red, dot: "bg-red-500" },
  warning: { pill: TONE.amber, dot: "bg-amber-500" },
  paused: { pill: TONE.muted, dot: "bg-slate-400" },
  waiting: { pill: TONE.muted, dot: "bg-slate-400" },
  completed: { pill: TONE.green, dot: "bg-emerald-500" },
  normal: { pill: TONE.sky, dot: "bg-sky-500" },
};

/**
 * The SLA badge, in its own component so the 30-second tick re-renders this
 * cell and not the whole table. The "Resumes …" opening is in the viewer's
 * time zone, so it is only shown once mounted.
 */
function SlaBadge({ ticket }: { ticket: Ticket }) {
  const now = useNow(30_000);
  const mounted = useMounted();
  const live = computeLiveSla(ticket, now);
  if (live.text === NO_SLA_TEXT || !live.text) {
    return <span className="text-slate-400">{NO_SLA_TEXT}</span>;
  }
  const style = SLA_PILL[live.type] ?? SLA_PILL.normal;
  return (
    <span
      // Read from the clock, which differs between server render and browser.
      suppressHydrationWarning
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md px-2 text-xs font-semibold whitespace-nowrap tabular-nums ring-1 ring-inset",
        style.pill,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
      <span className="truncate">
        {live.type === "waiting" && !mounted
          ? "Outside business hours"
          : live.text}
      </span>
    </span>
  );
}

export default function TicketsTable({
  initialTickets,
  totalCount,
  viewTabs = NO_VIEW_TABS,
  tenant,
  canAssignToSelf = true,
  page,
  limit,
}: TicketsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // ?new=1 is the N shortcut pressed on another page (GlobalShortcuts).
  const [isSheetOpen, setIsSheetOpen] = useState(
    () => searchParams.get("new") === "1",
  );
  useRealtimeTicketsRefresh(tenant, initialTickets[0]?.tenant_id);
  const [pickedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  // Only rows still on screen count: a realtime refresh can drop a picked
  // ticket from this view without the URL changing.
  const visibleIds = new Set(initialTickets.map((t) => t.id));
  const selectedTicketIds = pickedTicketIds.filter((id) => visibleIds.has(id));
  // A selection only covers the rows on screen: moving to another page,
  // filter or search drops it, so a bulk action can't reach hidden tickets.
  const viewKey = searchParams.toString();
  const [selectionViewKey, setSelectionViewKey] = useState(viewKey);
  if (selectionViewKey !== viewKey) {
    setSelectionViewKey(viewKey);
    setSelectedTicketIds([]);
  }
  const urlSearch = searchParams.get("search") || "";
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  // Follow ?search= when it changes from outside the box (back/forward), but
  // not when it's the box's own debounced write catching up.
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
  const [sentSearch, setSentSearch] = useState(urlSearch);
  if (seenUrlSearch !== urlSearch) {
    setSeenUrlSearch(urlSearch);
    if (urlSearch !== sentSearch) {
      setSearchQuery(urlSearch);
      setSentSearch(urlSearch);
    }
  }
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    [],
  );
  const [bulkAction, setBulkAction] = useState<
    "assign" | "priority" | "solved" | null
  >(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // A bulk priority that lowers at least one ticket, waiting for confirmation.
  const [bulkLowerTo, setBulkLowerTo] = useState<TicketPriority | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<
    Record<ColumnKey, boolean>
  >({
    id: true,
    subject: true,
    requester: true,
    priority: true,
    assignee: true,
    status: true,
    sla: true,
  });

  const toggleColumn = (column: ColumnKey) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTicketIds(initialTickets.map((t) => t.id));
    } else {
      setSelectedTicketIds([]);
    }
  };

  const handleSelectRow = (ticketId: string, checked: boolean) => {
    if (checked) {
      setSelectedTicketIds((prev) => [...prev, ticketId]);
    } else {
      setSelectedTicketIds((prev) => prev.filter((id) => id !== ticketId));
    }
  };

  const runBulkAction = async (
    action: "assign" | "priority" | "solved",
    priority?: TicketPriority,
  ) => {
    if (selectedTicketIds.length === 0) return;
    setBulkAction(action);
    setBulkError(null);

    try {
      const res = await (action === "assign"
        ? bulkAssignToMeAction({
            tenantSlug: tenant,
            ticketIds: selectedTicketIds,
          })
        : action === "priority"
          ? bulkSetPriorityAction({
              tenantSlug: tenant,
              ticketIds: selectedTicketIds,
              priority: priority!,
            })
          : bulkMarkSolvedAction({
              tenantSlug: tenant,
              ticketIds: selectedTicketIds,
            }));

      if (res.success) {
        setSelectedTicketIds([]);
        setBulkLowerTo(null);
        if ("slaKept" in res && res.slaKept) {
          toast.success(
            `${res.slaKept} ticket${res.slaKept === 1 ? "" : "s"} kept ${res.slaKept === 1 ? "its" : "their"} SLA deadline`,
            {
              description: `${res.slaKept === 1 ? "It was" : "They were"} due soon, so the original deadline stays as it was.`,
            },
          );
        }
        if ("failed" in res && res.failed) {
          toast.warning(
            `${res.failed} ticket${res.failed === 1 ? "" : "s"} couldn't be updated`,
            { description: "The rest of the selected tickets were updated." },
          );
        }
        // The bulk actions' revalidatePath refreshes the list.
      } else {
        setBulkError(res.error || "Failed to update tickets.");
        // The confirm dialog covers the inline error; say it there too.
        if (action === "priority")
          toast.error("Couldn't update the tickets", {
            description: res.error,
          });
      }
    } catch {
      // Thrown inside a transition this would reach error.tsx and replace
      // the whole list; keep it inline like any other failure.
      setBulkError("Couldn't reach the server. Try again.");
      if (action === "priority")
        toast.error("Couldn't update the tickets", {
          description: "Couldn't reach the server. Try again.",
        });
    } finally {
      setBulkAction(null);
    }
  };

  const handleAssignToMe = () => {
    startTransition(() => runBulkAction("assign"));
  };

  // Lowering any selected ticket asks for confirmation first.
  const handleSetPriority = (value: string) => {
    const priority = value as TicketPriority;
    const lowersAny = initialTickets.some(
      (t) =>
        selectedTicketIds.includes(t.id) &&
        isPriorityLowered(t.priority, priority),
    );
    if (lowersAny) {
      setBulkLowerTo(priority);
      return;
    }
    startTransition(() => runBulkAction("priority", priority));
  };

  const handleMarkSolved = () => {
    startTransition(() => runBulkAction("solved"));
  };

  // Drop ?new=1 once read, so a refresh or Back doesn't reopen the sheet.
  // history.replaceState keeps it client-side: no server round trip.
  const opensFromUrl = searchParams.get("new") === "1";
  useEffect(() => {
    if (!opensFromUrl) return;
    const params = new URLSearchParams(window.location.search);
    params.delete("new");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [opensFromUrl, pathname]);

  const canRunBulk =
    selectedTicketIds.length > 0 && bulkAction === null && !isPending;
  useKeyboardShortcut("n", () => setIsSheetOpen(true));
  useKeyboardShortcut("a", handleAssignToMe, canAssignToSelf && canRunBulk);
  useKeyboardShortcut("e", handleMarkSolved, canRunBulk);

  const getStatusBadge = (status: string) => {
    const key = status?.toLowerCase() as TicketStatus;
    if (!(key in STATUS_BADGE)) {
      return (
        <Badge variant="outline" className="h-6 rounded-md px-2 text-xs">
          {status}
        </Badge>
      );
    }
    return (
      <Badge className={cn(PILL, STATUS_BADGE[key])}>
        {TICKET_STATUS_LABELS[key]}
      </Badge>
    );
  };

  // The status badge's pill, with the SLA editor's priority dot inside.
  const getPriorityBadge = (priority: string) => {
    const style = PRIORITY_STYLES[priority?.toLowerCase()];
    return (
      <Badge className={cn(PILL, style?.badge ?? TONE.muted)}>
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            style?.dot ?? "bg-slate-400",
          )}
        />
        {TICKET_PRIORITY_LABELS[priority?.toLowerCase() as TicketPriority] ??
          priority}
      </Badge>
    );
  };

  const updateQueryParam = (key: string, value: string, replace = false) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") params.set("page", "1");

    startTransition(() => {
      const url = `${pathname}?${params.toString()}`;
      if (replace) router.replace(url);
      else router.push(url);
    });
  };

  // "All tickets" is the queue with no view, so it is active when ?view= is
  // missing; every other tab when ?view= is its id.
  const activeViewId = searchParams.get("view");
  // The tab replaces the view only; search, priority and status stay and
  // narrow it further, as "Search this view" says.
  const openViewTab = (tab: SavedViewTab) =>
    updateQueryParam("view", tab.isAll ? "all" : tab.id);

  // Same defaults as the page: subject A→Z.
  const currentSort = searchParams.get("sort") || "subject";
  const currentSortOrder =
    searchParams.get("sortOrder") ||
    (currentSort === "subject" ? "asc" : "desc");

  const handleSortToggle = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === "subject") {
      params.set("sortOrder", currentSortOrder === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", "subject");
      params.set("sortOrder", "asc");
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // As the page clamps them, so the pager names the page actually loaded.
  const currentPage =
    page ?? Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1);
  const currentLimit =
    limit ??
    (TICKET_PAGE_SIZES.includes(Number(searchParams.get("limit")))
      ? Number(searchParams.get("limit"))
      : TICKET_PAGE_SIZES[0]);
  const totalPages = Math.ceil(totalCount / currentLimit);

  // A page past the end (after a bulk resolve or a realtime removal on page
  // 2+) would read as "Queue clear" with no pager: go to the last real page.
  const pastEnd = initialTickets.length === 0 && currentPage > 1;
  const lastPage = Math.max(1, totalPages);
  useEffect(() => {
    if (!pastEnd) return;
    const params = new URLSearchParams(window.location.search);
    params.set("page", String(lastPage));
    router.replace(`${pathname}?${params.toString()}`);
  }, [pastEnd, lastPage, pathname, router]);

  // The column that carries the row's link: the subject, else the first
  // column still shown.
  const linkColumn = (
    [
      "subject",
      "id",
      "requester",
      "priority",
      "assignee",
      "status",
      "sla",
    ] as ColumnKey[]
  ).find((c) => visibleColumns[c]);
  // In a narrow card (a laptop with the sidebar open) the requester folds
  // under the subject instead of taking a column of its own.
  const foldRequester = Boolean(
    visibleColumns?.subject && visibleColumns?.requester,
  );
  const REQUESTER_COL = foldRequester ? "hidden @5xl:table-cell" : "";

  // No tickets at all (not just none matching a search or filter): the
  // tabs, columns, search and filters show but are disabled, as there is
  // nothing to narrow. With a filter on they stay usable so it can be cleared.
  const isFiltered = ["search", "priority", "status", "view"].some((key) =>
    searchParams.get(key),
  );
  const queueEmpty = totalCount === 0 && !isFiltered;

  const isAllSelected =
    initialTickets.length > 0 &&
    initialTickets.every((t) => selectedTicketIds.includes(t.id));

  return (
    <div className="h-full overflow-y-auto p-4 font-sans sm:p-6 lg:p-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-brand-700 uppercase">
              <TicketIcon className="size-3.5" strokeWidth={2} aria-hidden />
              Workspace
            </span>
            <h1 className="font-heading text-[1.75rem] leading-tight font-bold tracking-tight text-foreground sm:text-[2rem]">
              Tickets
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500 tabular-nums sm:text-[15px]">
              {totalCount} total tickets ·{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Tenant: {tenant}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={queueEmpty}
                  className={cn(DASHBOARD_BUTTON, "gap-2 bg-card")}
                >
                  <Columns className="size-4" aria-hidden />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-xs p-2">
                <DropdownMenuLabel className="text-[11px] font-bold text-slate-500 px-2 py-1.5">
                  Toggle Columns
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.id}
                  onCheckedChange={() => toggleColumn("id")}
                  className="py-2 px-2.5"
                >
                  Ticket
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.subject}
                  onCheckedChange={() => toggleColumn("subject")}
                  className="py-2 px-2.5"
                >
                  Subject
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.requester}
                  onCheckedChange={() => toggleColumn("requester")}
                  className="py-2 px-2.5"
                >
                  Requester
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.priority}
                  onCheckedChange={() => toggleColumn("priority")}
                  className="py-2 px-2.5"
                >
                  Priority
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.assignee}
                  onCheckedChange={() => toggleColumn("assignee")}
                  className="py-2 px-2.5"
                >
                  Assignee
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.status}
                  onCheckedChange={() => toggleColumn("status")}
                  className="py-2 px-2.5"
                >
                  Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns?.sla}
                  onCheckedChange={() => toggleColumn("sla")}
                  className="py-2 px-2.5"
                >
                  SLA
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={() => setIsSheetOpen(true)}
              className={cn(
                DASHBOARD_BUTTON,
                "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
              )}
            >
              New ticket
            </Button>
          </div>
        </div>

        <div className={cn(DASHBOARD_CARD, "@container p-3")}>
          <div className="flex flex-col gap-3 @[72rem]:flex-row @[72rem]:items-center @[72rem]:justify-between">
            <div className="min-w-0">
              <Suspense fallback={<TicketViewTabsSkeleton />}>
                <TicketViewTabs
                  tabs={viewTabs}
                  activeViewId={activeViewId}
                  onOpen={openViewTab}
                  disabled={queueEmpty}
                />
              </Suspense>
            </div>

            <div className="grid grid-cols-2 gap-3 @[40rem]:flex @[40rem]:items-center @[40rem]:justify-end @[72rem]:flex-1">
              <div className="col-span-2 @[40rem]:order-last @[40rem]:w-64 @[48rem]:w-72">
                <label htmlFor="ticket-search" className="sr-only">
                  Search
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="ticket-search"
                    type="text"
                    value={searchQuery}
                    disabled={queueEmpty}
                    placeholder="Search this view"
                    onChange={(e) => {
                      // One navigation once typing stops, replacing the entry,
                      // instead of a server render and a history step per key.
                      const value = e.target.value;
                      setSearchQuery(value);
                      if (searchTimer.current)
                        clearTimeout(searchTimer.current);
                      // Built from the live URL when it fires: a filter picked in
                      // the meantime must not be overwritten by this render's copy.
                      searchTimer.current = setTimeout(() => {
                        const params = new URLSearchParams(
                          window.location.search,
                        );
                        if (value) params.set("search", value);
                        else params.delete("search");
                        params.set("page", "1");
                        setSentSearch(value);
                        startTransition(() => {
                          router.replace(`${pathname}?${params.toString()}`);
                        });
                      }, 300);
                    }}
                    className="h-10 rounded-lg bg-card pl-9"
                  />
                </div>
              </div>

              <div className="w-full @[40rem]:w-40">
                <Select
                  value={searchParams?.get("priority") || "all"}
                  onValueChange={(val) => updateQueryParam("priority", val)}
                  disabled={queueEmpty}
                >
                  <SelectTrigger
                    aria-label="Priority"
                    className="h-10! min-h-10 w-full rounded-lg bg-card"
                  >
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    align="start"
                    position="popper"
                    className="p-1"
                  >
                    <SelectItem value="all" className="cursor-pointer p-2">
                      All priorities
                    </SelectItem>
                    {TICKET_PRIORITIES.map((p) => (
                      <SelectItem
                        key={p}
                        value={p}
                        className="cursor-pointer p-2"
                      >
                        {TICKET_PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full @[40rem]:w-40">
                <Select
                  value={searchParams?.get("status") || "all"}
                  onValueChange={(val) => updateQueryParam("status", val)}
                  disabled={queueEmpty}
                >
                  <SelectTrigger
                    aria-label="Status"
                    className="h-10! min-h-10 w-full rounded-lg bg-card"
                  >
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    align="start"
                    position="popper"
                    className="p-1"
                  >
                    <SelectItem value="all" className="cursor-pointer p-2">
                      All statuses
                    </SelectItem>
                    {TICKET_STATUSES.map((st) => (
                      <SelectItem
                        key={st}
                        value={st}
                        className="cursor-pointer p-2"
                      >
                        {TICKET_STATUS_LABELS[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {selectedTicketIds.length > 0 && (
          <div
            className={cn(
              DASHBOARD_CARD,
              "flex flex-col gap-4 border-brand-accent/25! bg-brand-soft/60 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between",
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground"
              >
                <Check className="size-5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-base font-bold tracking-tight text-foreground tabular-nums">
                  {selectedTicketIds.length}{" "}
                  {selectedTicketIds.length === 1 ? "item" : "items"} selected
                </p>
                <p
                  className={cn(
                    "text-sm",
                    bulkError
                      ? "font-medium text-red-600"
                      : "text-slate-500 dark:text-muted-foreground",
                  )}
                >
                  {bulkError ||
                    "Choose an action to manage the selected tickets"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {canAssignToSelf && (
                <Button
                  variant="outline"
                  onClick={handleAssignToMe}
                  disabled={bulkAction !== null || isPending}
                  className={BULK_ACTION_BUTTON}
                >
                  {bulkAction === "assign" ? (
                    <Loader2 className="size-4 animate-spin text-brand-accent" />
                  ) : (
                    <UserRound className="size-4 text-brand-accent" />
                  )}
                  Assign to me
                </Button>
              )}

              <Select
                value=""
                onValueChange={handleSetPriority}
                disabled={bulkAction !== null || isPending}
              >
                <SelectTrigger
                  aria-label="Set priority"
                  className={cn(
                    BULK_ACTION_BUTTON,
                    "gap-2 data-[size=default]:h-10 [&>svg:last-child]:text-slate-500",
                  )}
                >
                  <Flag className="size-4 text-amber-600" />
                  Set priority
                </SelectTrigger>
                <SelectContent
                  side="bottom"
                  align="start"
                  position="popper"
                  className="p-1"
                >
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem
                      key={p}
                      value={p}
                      className="cursor-pointer p-2"
                    >
                      {TICKET_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={handleMarkSolved}
                disabled={bulkAction !== null || isPending}
                className={BULK_ACTION_BUTTON}
              >
                {bulkAction === "solved" ? (
                  <Loader2 className="size-4 animate-spin text-brand-accent" />
                ) : (
                  <CircleCheck className="size-4 text-emerald-600" />
                )}
                Mark resolved
              </Button>

              <span
                aria-hidden
                className="mx-1 hidden h-8 w-px bg-slate-200 sm:block dark:bg-border"
              />

              <Button
                onClick={() => setSelectedTicketIds([])}
                disabled={bulkAction !== null || isPending}
                className={cn(
                  DASHBOARD_BUTTON,
                  "gap-2 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90",
                )}
              >
                <BrushCleaning className="size-4" />
                Clear selection
              </Button>
            </div>
          </div>
        )}

        <div className={cn(DASHBOARD_CARD, "overflow-hidden")}>
          <div>
            {initialTickets.length === 0 ? (
              <TicketsEmptyState
                {...(queueEmpty && {
                  title: "No tickets yet",
                  description:
                    "Tickets your customers raise will show up here. You can also raise one on a customer's behalf.",
                })}
                onAction={() => setIsSheetOpen(true)}
              />
            ) : (
              /* Fixed layout with set column widths, so the subject takes what
                 is left and ends in "…" rather than pushing the table wider
                 than the card. Below 832px (phones, tablets) it scrolls sideways,
                 which keeps about 13rem for the subject instead of a few letters. */
              <div className="@container overflow-x-auto">
                <Table className="min-w-208 table-fixed">
                  <TableHeader className="bg-slate-50/80 dark:bg-muted/40 [&_tr]:border-b-0">
                    <TableRow className="shadow-[inset_0_-1px_0_var(--border)] hover:bg-transparent">
                      <TableHead className="h-10 w-11 px-3 text-center align-middle">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) =>
                            handleSelectAll(Boolean(checked))
                          }
                          aria-label="Select all tickets on this page"
                          className="size-4 rounded-[5px] border-[1.5px] border-slate-300! data-[state=checked]:border-brand-accent! data-[state=checked]:bg-brand-accent data-[state=checked]:text-white dark:border-slate-500!"
                        />
                      </TableHead>

                      {visibleColumns?.id && (
                        <TableHead className={cn(TH, "w-18")}>TICKET</TableHead>
                      )}

                      {visibleColumns?.subject && (
                        <TableHead className={TH}>
                          <button
                            type="button"
                            onClick={handleSortToggle}
                            className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-500 uppercase transition-colors select-none hover:text-foreground"
                          >
                            <span>SUBJECT</span>
                            {currentSort === "subject" && (
                              <span aria-hidden>
                                {currentSortOrder === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </button>
                        </TableHead>
                      )}

                      {visibleColumns?.requester && (
                        <TableHead
                          className={cn(TH, "w-44 @6xl:w-52", REQUESTER_COL)}
                        >
                          REQUESTER
                        </TableHead>
                      )}

                      {visibleColumns?.priority && (
                        <TableHead className={cn(TH, "w-26")}>
                          PRIORITY
                        </TableHead>
                      )}

                      {visibleColumns?.assignee && (
                        <TableHead
                          className={cn(TH, "w-36 @5xl:w-40 @6xl:w-48")}
                        >
                          ASSIGNEE
                        </TableHead>
                      )}

                      {visibleColumns?.status && (
                        <TableHead className={cn(TH, "w-28")}>STATUS</TableHead>
                      )}

                      {visibleColumns?.sla && (
                        <TableHead
                          className={cn(TH, "w-36 @6xl:w-40 text-right")}
                        >
                          SLA
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody className="text-sm">
                    {initialTickets.map((ticket) => {
                      const isSelected = selectedTicketIds.includes(ticket.id);
                      const ticketHref = tenantPath(
                        tenant,
                        `${TENANT_ROUTES.TICKETS}/${ticket.id}`,
                      );
                      // One link per row, in the first visible column, so a
                      // screen reader meets each ticket once; the rest of the
                      // row opens it on click as before.
                      const cell = (
                        col: ColumnKey,
                        className: string,
                        children: ReactNode,
                      ) =>
                        col === linkColumn ? (
                          <Link href={ticketHref} className={className}>
                            {children}
                          </Link>
                        ) : (
                          <div className={className}>{children}</div>
                        );

                      return (
                        <TableRow
                          key={ticket.id}
                          onClick={(e) => {
                            const target = e.target as HTMLElement;
                            // The link and the checkbox handle their own
                            // clicks.
                            if (target.closest("a, button, [data-row-select]"))
                              return;
                            // Selecting text in a row shouldn't open it.
                            if (window.getSelection()?.toString()) return;
                            if (e.metaKey || e.ctrlKey) {
                              window.open(ticketHref, "_blank", "noopener");
                            } else {
                              router.push(ticketHref);
                            }
                          }}
                          className={cn(
                            "group cursor-pointer transition-colors hover:bg-slate-50/60 dark:hover:bg-muted/40",
                            isSelected &&
                              "bg-brand-soft/50 hover:bg-brand-soft/70",
                          )}
                        >
                          <TableCell
                            data-row-select
                            className="px-3 py-3 text-center align-middle"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleSelectRow(ticket.id, Boolean(checked))
                              }
                              aria-label={`Select ticket #${ticket.number ?? ticket.id}`}
                              className="size-4 rounded-[5px] border-[1.5px] border-slate-300! data-[state=checked]:border-brand-accent! data-[state=checked]:bg-brand-accent data-[state=checked]:text-white dark:border-slate-500!"
                            />
                          </TableCell>

                          {visibleColumns?.id && (
                            <TableCell className="px-3 py-3 align-middle text-sm font-medium text-slate-500 tabular-nums">
                              {cell(
                                "id",
                                "block py-1 hover:text-foreground",
                                <>#{ticket.number ?? "-"}</>,
                              )}
                            </TableCell>
                          )}

                          {visibleColumns?.subject && (
                            <TableCell className="px-3 py-3 align-middle">
                              {cell(
                                "subject",
                                "block min-w-0 py-1",
                                <>
                                  <span
                                    title={ticket.subject ?? undefined}
                                    className="block truncate font-semibold text-foreground"
                                  >
                                    {ticket.subject
                                      ? ticket.subject.charAt(0).toUpperCase() +
                                        ticket.subject.slice(1)
                                      : ""}
                                  </span>
                                  {foldRequester && (
                                    <span className="mt-0.5 block truncate text-xs text-slate-500 @5xl:hidden">
                                      {ticket.customers?.full_name ||
                                        "Customer"}
                                      {ticket.customers?.company &&
                                        ` · ${ticket.customers.company}`}
                                    </span>
                                  )}
                                  {ticket.tags && ticket.tags.length > 0 && (
                                    <span className="mt-1 flex flex-wrap gap-1">
                                      {ticket.tags.slice(0, 3).map((tag) => (
                                        <span
                                          key={tag.id}
                                          className="rounded-md bg-slate-100 px-1.5 py-px text-[11px] font-medium text-slate-600 ring-1 ring-slate-500/10 ring-inset"
                                        >
                                          {tag.name}
                                        </span>
                                      ))}
                                      {ticket.tags.length > 3 && (
                                        <span className="text-[11px] font-medium text-slate-400">
                                          +{ticket.tags.length - 3}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </>,
                              )}
                            </TableCell>
                          )}

                          {visibleColumns?.requester && (
                            <TableCell
                              className={cn(
                                "px-3 py-3 align-middle",
                                REQUESTER_COL,
                              )}
                            >
                              {cell(
                                "requester",
                                "block py-1",
                                <>
                                  <div className="truncate text-sm font-semibold text-foreground leading-snug">
                                    {ticket.customers?.full_name || "Customer"}
                                  </div>
                                  {ticket.customers?.company && (
                                    <div className="truncate text-xs leading-snug text-slate-500">
                                      {ticket.customers.company}
                                    </div>
                                  )}
                                </>,
                              )}
                            </TableCell>
                          )}

                          {visibleColumns?.priority && (
                            <TableCell className="px-3 py-3 text-left align-middle">
                              {cell(
                                "priority",
                                "inline-flex py-1",
                                getPriorityBadge(ticket.priority),
                              )}
                            </TableCell>
                          )}

                          {visibleColumns?.assignee && (
                            <TableCell className="px-3 py-3 align-middle text-sm text-foreground">
                              {cell(
                                "assignee",
                                "block py-1",
                                ticket.assignee_name ? (
                                  <span
                                    title={ticket.assignee_name}
                                    className="flex min-w-0 items-center gap-2 font-medium whitespace-nowrap"
                                  >
                                    {ticket.assignee_initials && (
                                      <PersonAvatar
                                        src={ticket.assignee_avatar_url}
                                        initials={ticket.assignee_initials}
                                        className="size-5 shrink-0"
                                        fallbackClassName="bg-slate-100 text-[10px] font-semibold text-slate-600"
                                      />
                                    )}
                                    <span className="truncate">
                                      {ticket.assignee_name}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-2 text-slate-500 font-medium whitespace-nowrap">
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400">
                                      -
                                    </span>
                                    Unassigned
                                  </span>
                                ),
                              )}
                            </TableCell>
                          )}

                          {visibleColumns?.status && (
                            <TableCell className="px-3 py-3 text-left align-middle">
                              {cell(
                                "status",
                                "inline-flex py-1",
                                getStatusBadge(ticket.status),
                              )}
                            </TableCell>
                          )}

                          {visibleColumns?.sla && (
                            <TableCell className="px-3 py-3 text-right align-middle text-xs">
                              {cell(
                                "sla",
                                "inline-flex w-full justify-end py-1",
                                <SlaBadge ticket={ticket} />,
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          {initialTickets.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-slate-50/50 px-3 py-3 text-sm text-slate-500 sm:flex-row dark:bg-muted/30">
              <div className="flex items-center gap-2 tabular-nums">
                <span>
                  Showing {initialTickets.length} of {totalCount}
                </span>
                <span className="ml-3 hidden text-muted-foreground sm:inline-block">
                  Rows per page
                </span>
                <Select
                  value={String(currentLimit)}
                  onValueChange={(val) => updateQueryParam("limit", val)}
                >
                  <SelectTrigger className="h-9 min-h-9 w-20 rounded-lg bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    side="bottom"
                    align="start"
                    position="popper"
                    className="p-1"
                  >
                    {TICKET_PAGE_SIZES.map((size) => (
                      <SelectItem
                        key={size}
                        value={String(size)}
                        className="cursor-pointer p-2"
                      >
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1}
                  onClick={() =>
                    updateQueryParam("page", String(currentPage - 1))
                  }
                  aria-label="Previous page"
                  className="size-9 rounded-lg bg-card shadow-none"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Page ${currentPage}`}
                  aria-current="page"
                  className="h-9 min-w-9 rounded-lg border-brand-accent/30! bg-brand-soft px-3 font-semibold text-brand-ink tabular-nums shadow-none hover:bg-brand-soft hover:text-brand-ink"
                >
                  {currentPage}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages || totalPages === 0}
                  onClick={() =>
                    updateQueryParam("page", String(currentPage + 1))
                  }
                  aria-label="Next page"
                  className="size-9 rounded-lg bg-card shadow-none"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          )}
        </div>

        <CreateTicketSheet
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          tenant={tenant}
        />

        <PriorityConfirmDialog
          open={bulkLowerTo !== null}
          to={bulkLowerTo}
          ticketCount={selectedTicketIds.length}
          pending={bulkAction === "priority"}
          onCancel={() => setBulkLowerTo(null)}
          onConfirm={() =>
            bulkLowerTo &&
            startTransition(() => runBulkAction("priority", bulkLowerTo))
          }
        />
      </div>
    </div>
  );
}
