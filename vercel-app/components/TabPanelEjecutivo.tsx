"use client";

import React from "react";
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
import { formatCOP } from "../lib/projects";
import { ConsolidationResult, LiquidationParams } from "../lib/types";

interface TabPanelEjecutivoProps {
  data: ConsolidationResult;
  params: LiquidationParams;
}

export default function TabPanelEjecutivo({
  data,
  params,
}: TabPanelEjecutivoProps) {
  const { totals, resumen_caps } = data;
  const pctAiu = (params.pct_a + params.pct_i + params.pct_u) / 100;
  const totalContratadoAiu = totals.total_ppto_contratado * (1 + pctAiu);
  const totalEjecAiu = totals.total_costo_ejecutado * (1 + pctAiu);

  const kpis = [
    {
      label: "Presupuesto Base Directo",
      value: formatCOP(totals.total_ppto_contratado),
      sub: `+ AIU: ${formatCOP(totalContratadoAiu)}`,
      border: "border-l-4 border-l-slate-800",
      valColor: "text-slate-900",
    },
    {
      label: "Ejecutado Acumulado (Dir.)",
      value: formatCOP(totals.total_costo_ejecutado),
      sub: `${totals.avance_financiero_global.toFixed(1)}% financiero (+AIU: ${formatCOP(totalEjecAiu)})`,
      border: "border-l-4 border-l-emerald-500",
      valColor: "text-emerald-700",
    },
    {
      label: "Saldo por Ejecutar (Dir.)",
      value: formatCOP(totals.total_saldo_dinero),
      sub: "Disponible contractual",
      border: "border-l-4 border-l-slate-600",
      valColor: "text-slate-900",
    },
    {
      label: "Alertas Mayores Cantidades",
      value: formatCOP(totals.total_sobrecosto_cop),
      sub:
        totals.total_sobrecosto_cop > 0
          ? "Requiere Acta de Adicional"
          : "Sin excedentes fuera de contrato",
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
    Presupuestado: Math.round(c.Presupuesto_Total / 1_000_000 * 100) / 100,
    Ejecutado: Math.round(c.Costo_Ejecutado / 1_000_000 * 100) / 100,
    Avance: c["Avance_%"],
  }));

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
              Progreso Físico Ponderado de Obra (BIM 5D)
            </span>
          </div>
          <span className="font-mono text-sm font-extrabold text-slate-900">
            {totals.avance_fisico_ponderado.toFixed(2)}% Completado
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
          <h3 className="text-sm font-extrabold text-slate-900 mb-1">
            📊 Presupuesto vs. Ejecución Real por Capítulo (Millones COP)
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Comparativo directo generado con agrupación por capítulos constructivos.
          </p>
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
                  tickFormatter={(v) => `$${v}M`}
                />
                <Tooltip
                  formatter={(val) => [`$${Number(val).toFixed(2)} M COP`, ""]}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#cbd5e1",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                <Bar
                  dataKey="Presupuestado"
                  name="Presupuesto Contractual"
                  fill="#94a3b8"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="Ejecutado"
                  name="Costo Ejecutado"
                  fill="#0f172a"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-5 bento-card overflow-hidden">
          <h3 className="text-sm font-extrabold text-slate-900 mb-1">
            📋 Resumen Financiero por Capítulo
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Estado de causación y saldo disponible por frente constructivo.
          </p>
          <div className="overflow-x-auto max-h-[320px]">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2 px-2">Capítulo</th>
                  <th className="py-2 px-2 text-right">Presupuesto</th>
                  <th className="py-2 px-2 text-right">Ejecutado</th>
                  <th className="py-2 px-2 text-right">% Av.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumen_caps.map((cap) => (
                  <tr key={cap.Capitulo} className="hover:bg-slate-50">
                    <td className="py-2.5 px-2 font-bold text-slate-800">
                      {cap.Capitulo}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-slate-700">
                      {formatCOP(cap.Presupuesto_Total)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                      {formatCOP(cap.Costo_Ejecutado)}
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
    </div>
  );
}
