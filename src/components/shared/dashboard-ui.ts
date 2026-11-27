/**
 * The dashboard design system, shared by every dashboard in the app (platform
 * console, workspace staff, billing, reports, settings). The pieces were built
 * for the platform console first and live there; import them from here in
 * workspace screens so all dashboards share one look.
 *
 * Note: StatCard / StatFilterCard show a tooltip for cut-off text, so they need
 * a TooltipProvider above them (the platform and workspace layouts have one).
 */
export {
  PLATFORM_BUTTON as DASHBOARD_BUTTON,
  PLATFORM_ICON_BUTTON as DASHBOARD_ICON_BUTTON,
  PLATFORM_CARD as DASHBOARD_CARD,
  PLATFORM_ICON_TILE as DASHBOARD_ICON_TILE,
  PLATFORM_TOOLBAR as DASHBOARD_TOOLBAR,
  PLATFORM_SEARCH as DASHBOARD_SEARCH,
  PLATFORM_STAT_GRID as DASHBOARD_STAT_GRID,
  PlatformPageHeader as DashboardPageHeader,
  PlatformPanel as DashboardPanel,
  PlatformSectionHeading as DashboardSectionHeading,
  PlatformEmpty as DashboardEmpty,
  PlatformFilterBar as DashboardFilterBar,
  StatFilterCard,
  SearchField,
  FilterSelect,
  FilterTabs,
  TablePaginationFooter,
  DataTable,
  type DataColumn,
} from "@/features/platform-admin/components/platform-ui";
export { StatCard } from "@/features/platform-admin/components/stat-card";
export { KpiTooltip } from "@/features/platform-admin/components/kpi-tooltip";
