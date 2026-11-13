"use client";

import React from "react";
import {
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Globe2,
  Layers,
  ShieldCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { EXCHANGE_RATES_COP, useAppPreferences } from "../lib/i18n";
import { ConsolidationResult, LiquidationParams } from "../lib/types";

interface TabPanelEjecutivoProps {
  data: ConsolidationResult;
  params: LiquidationParams;
}

export default function TabPanelEjecutivo({
  data,
  params,
}: TabPanelEjecutivoProps) {
  const {
    tr,
    formatMoney,
    formatCompactChartMoney,
    chartUnitSuffix,
    currency,
    lang,
  } = useAppPreferences();

  const { totals, resumen_caps } = data;
  const pctAiu = (params.pct_a + params.pct_i + params.pct_u) / 100;
  const totalContratadoAiu = totals.total_ppto_contratado * (1 + pctAiu);
  const totalEjecAiu = totals.total_costo_ejecutado * (1 + pctAiu);
  const currencyPrefix = currency === "EUR" ? "€" : "$";

  const kpis = [
    {
      label: tr.exec.kpiBaseDirect,
      value: formatMoney(totals.total_ppto_contratado),
      sub: `${tr.exec.withAiu}: ${formatMoney(totalContratadoAiu)}`,
      border: "border-l-4 border-l-slate-800",
      valColor: "text-slate-900",
    },
    {
      label: tr.exec.kpiExecDirect,
      value: formatMoney(totals.total_costo_ejecutado),
      sub: `${totals.avance_financiero_global.toFixed(1)}% ${tr.exec.financialPct} (${tr.exec.withAiu}: ${formatMoney(totalEjecAiu)})`,
      border: "border-l-4 border-l-emerald-500",
      valColor: "text-emerald-700",
    },
    {
      label: tr.exec.kpiRemaining,
      value: formatMoney(totals.total_saldo_dinero),
      sub: tr.exec.contractAvailable,
      border: "border-l-4 border-l-slate-600",
      valColor: "text-slate-900",
    },
    {
      label: tr.exec.kpiOverruns,
      value: formatMoney(totals.total_sobrecosto_cop),
      sub:
        totals.total_sobrecosto_cop > 0
          ? tr.exec.overrunNeeded
          : tr.exec.noOverruns,
      border:
        totals.total_sobrecosto_cop > 0
          ? "border-l-4 border-l-red-500"
          : "border-l-4 border-l-emerald-500",
      valColor:
        totals.total_sobrecosto_cop > 0 ? "text-red-600" : "text-emerald-700",
    },
  ];

  const chartData = resumen_caps.map((c) => ({
    name: c.Capitulo.length > 20 ? c.Capitulo.slice(0, 18) + "…" : c.Capitulo,
    fullName: c.Capitulo,
    Presupuestado: formatCompactChartMoney(c.Presupuesto_Total),
    Ejecutado: formatCompactChartMoney(c.Costo_Ejecutado),
    Avance: c["Avance_%"],
  }));

  const standardsBadges = [
    {
      icon: Layers,
      label: "ISO 19650 Information Mgmt",
    },
    {
      icon: Globe2,
      label: "OpenBIM IFC 2x3 / IFC4",
    },
    {
      icon: ShieldCheck,
      label: "PMI Earned Value (EVM)",
    },
    {
      icon: CalendarClock,
      label: "MS Project 4D Live Sync",
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPI Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`bento-card ${k.border}`}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {k.label}
            </div>
            <div className={`kpi-num text-xl sm:text-2xl font-extrabold mt-1 ${k.valColor}`}>
              {k.value}
            </div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Physical Progress Bar */}
      <div className="bento-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              {tr.exec.physicalProgressTitle}
            </span>
          </div>
          <span className="font-mono text-sm font-extrabold text-slate-900">
            {totals.avance_fisico_ponderado.toFixed(2)}% {tr.exec.completedLabel}
          </span>
        </div>
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(totals.avance_fisico_ponderado, 100)}%`,
              background: "linear-gradient(90deg, #334155 0%, #0f172a 48%, #10b981 100%)",
            }}
          />
        </div>
      </div>

      {/* Chart + Chapter Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 bento-card">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 mb-1">
            <BarChart3 className="w-4 h-4 text-slate-600 shrink-0" />
            <span>
              {tr.exec.chartTitle} ({chartUnitSuffix})
            </span>
          </h3>
          <p className="text-xs text-slate-500 mb-4">{tr.exec.chartSub}</p>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#475569", fontWeight: 600 }}
                  angle={-15}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#475569" }}
                  tickFormatter={(v) => `${currencyPrefix}${v}`}
                />
                <Tooltip
                  formatter={(val) => [
                    `${currencyPrefix}${Number(val).toFixed(2)} ${chartUnitSuffix}`,
                    "",
                  ]}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#cbd5e1",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                <Bar
                  dataKey="Presupuestado"
                  name={tr.exec.barBudget}
                  fill="#94a3b8"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="Ejecutado"
                  name={tr.exec.barExec}
                  fill="#0f172a"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-5 bento-card overflow-hidden">
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 mb-1">
            <ClipboardList className="w-4 h-4 text-slate-600 shrink-0" />
            <span>{tr.exec.chapterTableTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 mb-3">{tr.exec.chapterTableSub}</p>
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2 px-2">{tr.exec.colChapter}</th>
                  <th className="py-2 px-2 text-right">{tr.exec.colBudget}</th>
                  <th className="py-2 px-2 text-right">{tr.exec.colExecuted}</th>
                  <th className="py-2 px-2 text-right">{tr.exec.colPct}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumen_caps.map((cap) => (
                  <tr key={cap.Capitulo} className="hover:bg-slate-50">
                    <td className="py-2.5 px-2 font-bold text-slate-800">
                      {cap.Capitulo}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                      {formatMoney(cap.Presupuesto_Total)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                      {formatMoney(cap.Costo_Ejecutado)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] ${
                          cap["Avance_%"] >= 99
                            ? "bg-emerald-100 text-emerald-800"
                            : cap["Avance_%"] > 0
                            ? "bg-slate-200 text-slate-900 border border-slate-300"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {cap["Avance_%"].toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Enterprise BIM & EVM Standards Strip */}
      <div className="bento-card flex flex-wrap items-center justify-between gap-3 py-3.5 px-4">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{tr.exec.standardsStripTitle}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {standardsBadges.map((b) => {
            const Icon = b.icon;
            return (
              <span
                key={b.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700"
              >
                <Icon className="w-3 h-3 text-emerald-600 shrink-0" />
                {b.label}
              </span>
            );
          })}
          {currency !== "COP" && (
            <span
              className="text-[10px] font-semibold text-slate-500 ml-1"
              title={tr.exec.exchangeDisclaimer}
            >
              • {lang === "en" ? "FX Ref" : "TRM Ref"}: 1 {currency} = $
              {EXCHANGE_RATES_COP[currency].toLocaleString("en-US")} COP ({tr.exec.exchangeDisclaimer})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
