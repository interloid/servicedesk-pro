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

// Passed the palette validator against the card surface (light mode).
const OK_COLOR = "#0d9488";
const ERROR_COLOR = "#dc2626";

function hourLabel(iso: string): string {
  return `${iso.slice(11, 13)}:00`;
}

export function ApiTrafficChart({ hours }: { hours: ApiTraffic["hours"] }) {
  const data = hours.map((hour) => ({ ...hour, label: hourLabel(hour.hour) }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
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
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={44}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
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
