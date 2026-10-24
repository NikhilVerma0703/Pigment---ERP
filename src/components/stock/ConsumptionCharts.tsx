"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { formatQty } from "@/lib/formula/calc";
import type { NamedKg, StockPageData, StockRow } from "@/lib/stock/queries";
import { cn } from "@/lib/utils";

// Categorical slots, fixed order (validated reference palette, light mode).
// Slots 1–3 validate in every pairing, so Stock / Consumed / Remaining are
// always distinguishable; trend lines take slots 1–5 in order.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
const GRID = "#e5e7eb";
const AXIS = { fontSize: 12, fill: "#6b7280" };
const COMPARE_MAX = 12;

const kg = (v: number) => `${formatQty(v)} kg`;
// Legend labels in text ink; the swatch beside each one carries the colour.
const legendText = (value: string) => <span style={{ color: "#4b5563" }}>{value}</span>;

function ChartCard({ title, caption, children, actions }: { title: string; caption?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {caption && <p className="mt-0.5 text-xs text-gray-500">{caption}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">{text}</div>;
}

/** Tooltip in text ink; the colour dot beside each value carries identity. */
function KgTooltip({ active, payload, label, labelFormat }: TooltipProps<number, string> & { labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-gray-900">{labelFormat ? labelFormat(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-gray-600">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-gray-900">{kg(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function StockComparisonChart({ stocks, rangeDays }: { stocks: StockRow[]; rangeDays: number }) {
  const data = [...stocks]
    .sort((a, b) => b.totalKg - a.totalKg)
    .slice(0, COMPARE_MAX)
    .map((s) => ({ name: s.name, stock: s.totalKg, consumed: s.periodConsumedKg, remaining: s.remainingKg }));
  return (
    <ChartCard
      title="Pigment/Color Stock vs Consumed vs Remaining"
      caption={`Consumed in the last ${rangeDays} days; Total Stock and Remaining are current${stocks.length > COMPARE_MAX ? ` — top ${COMPARE_MAX} pigments by total stock` : ""}. In kg.`}
    >
      {data.length === 0 ? (
        <Empty text="Add pigment stock to see this chart." />
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatQty(v, 1)} />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Tooltip content={<KgTooltip />} cursor={{ fill: "rgba(15,76,92,0.06)" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
              <Bar dataKey="stock" name="Total Stock" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="consumed" name={`Consumed (last ${rangeDays} days)`} fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="remaining" name="Remaining" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function ConsumptionTrendChart({ trend }: { trend: StockPageData["trend"] }) {
  const hasData = trend.series.length > 0;
  const day = (d: string) => format(parseISO(d), "dd MMM");
  return (
    <ChartCard
      title="Pigment/Color Consumption Trend"
      caption={`Daily consumption over the last ${trend.dates.length} days, in kg${hasData ? ` — the ${trend.series.length} most-consumed pigments` : ""}`}
    >
      {!hasData ? (
        <Empty text={`No pigment consumption in the last ${trend.dates.length} days.`} />
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend.rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={day} minTickGap={24} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatQty(v, 1)} />
              <Tooltip content={<KgTooltip labelFormat={(l) => format(parseISO(l), "dd MMM yyyy")} />} cursor={{ stroke: "#9ca3af", strokeDasharray: "3 3" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={legendText} />
              {trend.series.map((s, i) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  stroke={SERIES[i]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

export function MostConsumedChart({ pigments, materials, rangeDays }: { pigments: NamedKg[]; materials: NamedKg[]; rangeDays: number }) {
  const [view, setView] = useState<"pigments" | "materials">("pigments");
  const data = view === "pigments" ? pigments : materials;
  return (
    <ChartCard
      title="Most Consumed"
      caption={`Top ${view === "pigments" ? "pigments/colors" : "materials"} by consumption in the last ${rangeDays} days, in kg`}
      actions={
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-xs font-medium" role="tablist">
          {(["pigments", "materials"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn("rounded-md px-3 py-1.5 transition", view === v ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-50")}
            >
              {v === "pigments" ? "Pigments/Colors" : "Materials"}
            </button>
          ))}
        </div>
      }
    >
      {data.length === 0 ? (
        <Empty text={`No ${view === "pigments" ? "pigment" : "material"} consumption in the last ${rangeDays} days.`} />
      ) : (
        <div style={{ height: Math.max(180, data.length * 34 + 30) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => formatQty(v, 1)} />
              <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={110} />
              <Tooltip content={<KgTooltip />} cursor={{ fill: "rgba(15,76,92,0.06)" }} />
              <Bar
                dataKey="kg"
                name="Consumed"
                fill={SERIES[view === "pigments" ? 1 : 0]}
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
                label={{ position: "right", fontSize: 11, fill: "#374151", formatter: (v: number) => formatQty(v, 1) }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
