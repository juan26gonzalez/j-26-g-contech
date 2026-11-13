"use client";

import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAppPreferences } from "../lib/i18n";
import { ConsolidationResult } from "../lib/types";
import { localizeActivity } from "../lib/units";

interface TabMayoresCantidadesProps {
  data: ConsolidationResult;
}

export default function TabMayoresCantidades({
  data,
}: TabMayoresCantidadesProps) {
  const { lang, currency, formatMoney, formatQty, unitLabel } =
    useAppPreferences();
  const isEn = lang === "en";
  const mayores = data.df_5d.filter((r) => r.Mayor_Cantidad > 0);
  const bac = data.totals.total_ppto_contratado;
  const sobrecosto = data.totals.total_sobrecosto_cop;
  const eac = bac + sobrecosto;

  return (
    <div className="space-y-5">
      <div className="bento-card flex items-start gap-3">
        <span className="p-2.5 rounded-xl bg-amber-100 text-amber-800 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            {isEn
              ? "Change Orders, Quantity Overruns & Estimate at Completion (EAC)"
              : "Control de Mayores Cantidades, Obras Adicionales & Desviación (EAC)"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEn
              ? "Early detection of work packages exceeding 100% baseline scope and projected Estimate at Completion (EAC)."
              : "Detección temprana de actividades que superaron el 100% contratado y proyección de Costo Estimado al Cierre (EAC)."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card border-l-4 border-l-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Budget at Completion (BAC)" : "Presupuesto Inicial (BAC)"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(bac)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-red-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Quantity Overrun Cost" : "Sobrecosto por Excedentes"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-red-600 mt-1">
            {formatMoney(sobrecosto)}
          </div>
        </div>
        <div className="bento-card border-l-4 border-l-amber-500">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            {isEn ? "Estimate at Completion (EAC)" : "Proyección al Cierre (EAC)"}
          </div>
          <div className="kpi-num text-xl font-extrabold text-slate-900 mt-1">
            {formatMoney(eac)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {isEn
              ? `${mayores.length} item(s) require Change Order approval`
              : `${mayores.length} ítem(s) requieren Otrosí / Acta Adicional`}
          </div>
        </div>
      </div>

      <div className="bento-card">
        {mayores.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <div className="flex justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="text-sm font-extrabold text-emerald-700">
              {isEn
                ? "Zero Quantity Overrun Deviations"
                : "Cero Desviaciones por Mayor Cantidad"}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {isEn
                ? "All executed activities remain strictly within baseline contractual quantities."
                : "Todas las actividades ejecutadas se mantienen dentro de las cantidades contratadas en el presupuesto oficial."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-red-50 text-red-900 font-bold border-b border-red-200">
                <tr>
                  <th className="p-2.5">{isEn ? "Item" : "Ítem"}</th>
                  <th className="p-2.5">{isEn ? "Work Activity" : "Actividad"}</th>
                  <th className="p-2.5 text-center">{isEn ? "Unit" : "Und"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Contracted" : "Contratado"}</th>
                  <th className="p-2.5 text-right">{isEn ? "Executed" : "Ejecutado"}</th>
                  <th className="p-2.5 text-right text-red-700">
                    {isEn ? "Overrun Qty" : "Mayor Cantidad"}
                  </th>
                  <th className="p-2.5 text-right">
                    {isEn ? `Overrun Cost (${currency})` : `Sobrecosto (${currency})`}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mayores.map((r) => (
                  <tr key={r.Item} className="hover:bg-red-50/30">
                    <td className="p-2.5 font-mono font-bold">{r.Item}</td>
                    <td className="p-2.5 font-semibold">
                      {localizeActivity(r.Actividad, lang)}
                    </td>
                    <td className="p-2.5 text-center font-mono">
                      {unitLabel(r.Unidad)}
                    </td>
                    <td className="p-2.5 text-right font-mono">
                      {formatQty(r.Cantidad_Contratada, r.Unidad)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {formatQty(r.Cantidad_Ejecutada, r.Unidad)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-red-600">
                      + {formatQty(r.Mayor_Cantidad, r.Unidad)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-red-700">
                      {formatMoney(r.Mayor_Cantidad * r.Precio_Unitario)}
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
