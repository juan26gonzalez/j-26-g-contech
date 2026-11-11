"use client";

import React from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCOP } from "../lib/projects";
import { ConsolidationResult } from "../lib/types";

interface TabCurvaSProps {
  data: ConsolidationResult;
}

export default function TabCurvaS({ data }: TabCurvaSProps) {
  const bac = data.totals.total_ppto_contratado;
  const ev = data.totals.total_costo_ejecutado;
  const avReal = data.totals.avance_fisico_ponderado;
  const pvPct = 28.0;
  const pv = bac * (pvPct / 100);
  const spi = pv > 0 ? Math.round((ev / pv) * 100) / 100 : 1.0;
  const cpi = 1.02;

  const curvePoints = [
    { semana: "Sem 1", Programado: 8, Real: Math.min(avReal, 6.5) },
    { semana: "Sem 2", Programado: 18, Real: Math.min(avReal, 15.0) },
    { semana: "Sem 3 (Hoy)", Programado: pvPct, Real: avReal },
    { semana: "Sem 4 (Proy)", Programado: 58, Real: null },
    { semana: "Sem 5 (Proy)", Programado: 85, Real: null },
    { semana: "Sem 6 (Fin)", Programado: 100, Real: null },
  ];

  return (
    <div className="space-y-5">
      <div className="bento-card">
        <h2 className="text-base font-extrabold text-slate-900">
          📈 Curva S de Inversión Acumulada & Gestión del Valor Ganado (EVM 4D)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Comparativo de línea base programada (PV) contra el avance físico real ejecutado en campo (EV).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bento-card border-l-4 border-l-slate-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Valor Planeado a Hoy (PV)
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(pv)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{pvPct}% programado</div>
        </div>

        <div className="bento-card border-l-4 border-l-blue-600">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Valor Ganado Real (EV)
          </div>
          <div className="kpi-num text-xl font-extrabold text-blue-700 mt-1">
            {formatCOP(ev)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {avReal.toFixed(1)}% físico ejecutado
          </div>
        </div>

        <div className="bento-card border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Índice Desempeño Plazo (SPI)
          </div>
          <div className="kpi-num text-2xl font-extrabold text-slate-900 mt-1">
            {spi.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {spi >= 1 ? "✅ En tiempo o adelantado" : "⚠️ Desfase frente a línea base"}
          </div>
        </div>

        <div className="bento-card border-l-4 border-l-emerald-600">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Índice Desempeño Costo (CPI)
          </div>
          <div className="kpi-num text-2xl font-extrabold text-emerald-700 mt-1">
            {cpi.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Control eficiente de APU</div>
        </div>
      </div>

      <div className="bento-card">
        <h3 className="text-sm font-extrabold text-slate-900 mb-3">
          📉 Trayectoria Curva S: Programado vs. Avance Real (%)
        </h3>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={curvePoints} margin={{ top: 15, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
              <YAxis domain={[0, 110]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val) => [`${val}%`, ""]}
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
              <ReferenceLine
                y={100}
                stroke="#0f172a"
                strokeDasharray="4 4"
                label={{ value: "Meta 100%", position: "top", fontSize: 11, fontWeight: 700 }}
              />
              <Line
                type="monotone"
                dataKey="Programado"
                name="Curva S Programada (PV)"
                stroke="#64748b"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Real"
                name="Ejecutado Real (EV)"
                stroke="#2563eb"
                fill="#dbeafe"
                fillOpacity={0.65}
                strokeWidth={3}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
