"use client";

import React from "react";
import { formatCOP, formatNum } from "../lib/projects";
import { ConsolidationResult } from "../lib/types";

interface TabMayoresCantidadesProps {
  data: ConsolidationResult;
}

export default function TabMayoresCantidades({
  data,
}: TabMayoresCantidadesProps) {
  const mayores = data.df_5d.filter((r) => r.Mayor_Cantidad > 0);
  const bac = data.totals.total_ppto_contratado;
  const sobrecosto = data.totals.total_sobrecosto_cop;
  const eac = bac + sobrecosto;

  return (
    <div className="space-y-5">
      <div className="bento-card">
        <h2 className="text-base font-extrabold text-slate-900">
          ⚠️ Control de Mayores Cantidades, Obras Adicionales & Desviación (EAC)
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Detección temprana de actividades que superaron el 100% contratado y proyección de Costo Estimado al Cierre (EAC).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card border-l-4 border-l-blue-600">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Presupuesto Inicial (BAC)
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(bac)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-red-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Sobrecosto por Excedentes
          </div>
          <div className="kpi-num text-xl font-extrabold text-red-600 mt-1">
            {formatCOP(sobrecosto)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Proyección al Cierre (EAC)
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatCOP(eac)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {mayores.length} ítem(s) requieren Otrosí / Acta Adicional
          </div>
        </div>
      </div>

      <div className="bento-card">
        {mayores.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <div className="text-sm font-extrabold text-emerald-700">
              Cero Desviaciones por Mayor Cantidad
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Todas las actividades ejecutadas se mantienen dentro de las cantidades contratadas en el presupuesto oficial.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-red-50 text-red-900 font-bold border-b border-red-200">
                <tr>
                  <th className="p-2.5">Ítem</th>
                  <th className="p-2.5">Actividad</th>
                  <th className="p-2.5 text-center">Und</th>
                  <th className="p-2.5 text-right">Contratado</th>
                  <th className="p-2.5 text-right">Ejecutado</th>
                  <th className="p-2.5 text-right text-red-700">Mayor Cantidad</th>
                  <th className="p-2.5 text-right">Sobrecosto (COP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mayores.map((r) => (
                  <tr key={r.Item} className="hover:bg-red-50/30">
                    <td className="p-2.5 font-mono font-bold">{r.Item}</td>
                    <td className="p-2.5 font-semibold">{r.Actividad}</td>
                    <td className="p-2.5 text-center font-mono">{r.Unidad}</td>
                    <td className="p-2.5 text-right font-mono">
                      {formatNum(r.Cantidad_Contratada)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {formatNum(r.Cantidad_Ejecutada)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-red-600">
                      + {formatNum(r.Mayor_Cantidad)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-red-700">
                      {formatCOP(r.Sobrecosto_COP)}
                    </td>
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
