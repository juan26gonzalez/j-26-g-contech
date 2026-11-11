"use client";

import React from "react";
import { formatNum } from "../lib/projects";
import { ConsolidationResult } from "../lib/types";

interface TabRendimientoProps {
  data: ConsolidationResult;
}

export default function TabRendimiento({ data }: TabRendimientoProps) {
  const { rendimientos } = data;
  const avgEff =
    rendimientos.length > 0
      ? rendimientos.reduce((a, r) => a + r["Eficiencia_%"], 0) / rendimientos.length
      : 100;
  const alertas = rendimientos.filter((r) => r["Eficiencia_%"] < 90).length;

  return (
    <div className="space-y-5">
      <div className="bento-card">
        <h2 className="text-base font-extrabold text-slate-900">
          👥 Productividad de Mano de Obra & Eficiencia de Cuadrillas vs. APU
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Auditoría diaria de rendimientos promedio reales frente a los rendimientos teóricos presupuestados en los APU.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card border-l-4 border-l-blue-600">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Frentes con Registro
          </div>
          <div className="kpi-num text-2xl font-extrabold text-slate-900 mt-1">
            {rendimientos.length}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-emerald-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Eficiencia Global Cuadrillas
          </div>
          <div className="kpi-num text-2xl font-extrabold text-emerald-700 mt-1">
            {avgEff.toFixed(1)}%
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Frentes Bajo Rendimiento (&lt;90%)
          </div>
          <div className="kpi-num text-2xl font-extrabold text-amber-700 mt-1">
            {alertas}
          </div>
        </div>
      </div>

      <div className="bento-card">
        {rendimientos.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            Sin reportes diarios de bitácora en Supabase para calcular eficiencia de cuadrillas en este proyecto.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2.5">Actividad Reportada</th>
                  <th className="p-2.5">Cuadrilla Asignada</th>
                  <th className="p-2.5 text-right">Prod. Acumulada</th>
                  <th className="p-2.5 text-center">Jornadas</th>
                  <th className="p-2.5 text-right">Rend. Real Prom.</th>
                  <th className="p-2.5 text-right">Meta APU</th>
                  <th className="p-2.5 text-right">% Eficiencia</th>
                  <th className="p-2.5">Evaluación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rendimientos.map((r) => (
                  <tr key={r.Actividad} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">{r.Actividad}</td>
                    <td className="p-2.5 text-slate-600">{r.Cuadrilla_Asignada}</td>
                    <td className="p-2.5 text-right font-mono font-semibold">
                      {formatNum(r.Total_Producido)}
                    </td>
                    <td className="p-2.5 text-center font-mono">{r.Jornadas}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-blue-700">
                      {r.Rendimiento_Real}
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-600">
                      {r.Meta_APU_Teorica}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold">
                      {r["Eficiencia_%"].toFixed(1)}%
                    </td>
                    <td className="p-2.5 font-bold whitespace-nowrap">{r.Evaluacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
