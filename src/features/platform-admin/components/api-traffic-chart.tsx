"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ApiTraffic } from "../types";
import {
  CHART_COLORS,
  CHART_TICK,
  CHART_TOOLTIP_ITEM,
  CHART_TOOLTIP_LABEL,
  CHART_TOOLTIP_STYLE,
} from "./chart-theme";

// The console's shared chart palette (chart-theme.ts).
const OK_COLOR = CHART_COLORS.primary;
const ERROR_COLOR = CHART_COLORS.danger;

function hourLabel(iso: string): string {
  return `${iso.slice(11, 13)}:00`;
}

export function ApiTrafficChart({ hours }: { hours: ApiTraffic["hours"] }) {
  const data = hours.map((hour) => ({ ...hour, label: hourLabel(hour.hour) }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: OK_COLOR }}
            aria-hidden
          />
          Successful or client error
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: ERROR_COLOR }}
            aria-hidden
          />
          Server error (5xx)
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke={CHART_COLORS.grid}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={CHART_TICK}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={44}
              tick={CHART_TICK}
            />
            <Tooltip
              cursor={{ fill: CHART_COLORS.cursor }}
              labelStyle={CHART_TOOLTIP_LABEL}
              itemStyle={CHART_TOOLTIP_ITEM}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Bar
              dataKey="ok"
              name="Successful or client error"
              stackId="requests"
              fill={OK_COLOR}
              stroke="var(--card)"
              strokeWidth={2}
            />
            <Bar
              dataKey="serverErrors"
              name="Server error (5xx)"
              stackId="requests"
              fill={ERROR_COLOR}
              stroke="var(--card)"
              strokeWidth={2}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
