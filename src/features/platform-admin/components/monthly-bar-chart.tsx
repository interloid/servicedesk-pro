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

export type ChartSeries = { key: string; name: string; color: string };

/** One axis; a legend only when there is more than one series. */
export function MonthlyBarChart({
  data,
  series,
  formatValue = (value) => value.toLocaleString("en-US"),
}: {
  data: Array<Record<string, string | number>>;
  series: ChartSeries[];
  formatValue?: (value: number) => string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {series.length > 1 && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              {item.name}
            </span>
          ))}
        </div>
      )}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barGap={2}
            margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              minTickGap={16}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={44}
              tickFormatter={(value: number) => formatValue(value)}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              formatter={(value) => formatValue(Number(value))}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
            />
            {series.map((item) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.name}
                fill={item.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
