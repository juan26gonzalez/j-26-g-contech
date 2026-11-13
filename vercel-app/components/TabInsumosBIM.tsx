"use client";

import React, { useMemo, useState } from "react";
import { Boxes, Building2, HardHat, Package } from "lucide-react";
import { useAppPreferences } from "../lib/i18n";
import { ConsolidationResult, ProjectConfig } from "../lib/types";
import { localizeMaterialName } from "../lib/units";

interface TabInsumosBIMProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
}

export default function TabInsumosBIM({ proyecto, data }: TabInsumosBIMProps) {
  const { lang, unitLabel, formatQty } = useAppPreferences();
  const isEn = lang === "en";
  const [modo, setModo] = useState<"demanda" | "ejecutado">("demanda");
  const rawList =
    modo === "demanda" ? data.insumos_demanda : data.insumos_ejecutado;

  const grouped = useMemo(() => {
    const map = new Map<string, { Insumo: string; Unidad: string; Total: number }>();
    for (const r of rawList) {
      const key = `${r.Insumo}||${r.Unidad}`;
      const prev = map.get(key) || { Insumo: r.Insumo, Unidad: r.Unidad, Total: 0 };
      prev.Total += Number(r.Total_Teorico || 0);
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.Total - a.Total);
  }, [rawList]);

  return (
    <div className="space-y-5">
      <div className="bento-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="p-2.5 rounded-xl bg-slate-900 text-white shrink-0">
            <Boxes className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              {isEn
                ? "Parametric BIM Material Takeoff & Procurement Schedule"
                : "Explosión Paramétrica de Insumos BIM & Compras (Take-Off)"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEn
                ? "Automated procurement calculation for cement, sand, rebar, porcelain tile, finishes, and CMU blocks (Imperial US units)."
                : "Dosificación automática de cemento, arena, acero, porcelanato, pintura y bloques desde los metrados del proyecto."}
            </p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => setModo("demanda")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              modo === "demanda"
                ? "steel-btn-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{isEn ? "Total Project Demand" : "Demanda Total de Obra"}</span>
          </button>
          <button
            type="button"
            onClick={() => setModo("ejecutado")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${
              modo === "ejecutado"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <HardHat className="w-3.5 h-3.5" />
            <span>{isEn ? "Executed Consumption" : "Consumo Teórico Ejecutado"}</span>
          </button>
        </div>
      </div>

      {proyecto.id === "casa_mendoza" && (
        <div className="steel-subcard rounded-2xl p-4 text-xs text-slate-900 flex items-start gap-2.5">
          <Building2 className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" />
          <div>
            <div className="font-extrabold text-sm mb-1">
              {isEn
                ? "Autodesk Revit 2027 BIM Sync (Casa Mendoza 1.1.rvt)"
                : "Sincronización BIM Revit 2027 (Casa Mendoza 1.1.rvt)"}
            </div>
            <p className="text-slate-700">
              {isEn
                ? "When field logs carry the [BIM_TAKEOFF] tag from Revit or mobile capture, contracted masonry, flooring, plaster, and roofing quantities recalibrate automatically across material procurement."
                : "Cuando se cargan registros con etiqueta [BIM_TAKEOFF] desde la app de campo o Revit, las cantidades contratadas de Mampostería, Pisos, Pañete y Cubierta se recalibran automáticamente sobre toda la explosión de insumos."}
            </p>
          </div>
        </div>
      )}

      <div className="bento-card">
        {grouped.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            {isEn
              ? "No materials computed for the selected filter yet (pending executed quantities or standard APU recipes)."
              : "No hay insumos calculados para el filtro seleccionado (sin avance ejecutado aún o actividades sin dosificación estándar)."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2.5">
                    {isEn ? "Construction Material / Procurement SKU" : "Insumo / Material de Obra"}
                  </th>
                  <th className="p-2.5 text-center w-36">
                    {isEn ? "Purchase Unit" : "Unidad Compra"}
                  </th>
                  <th className="p-2.5 text-right w-44">
                    {isEn ? "Consolidated Qty" : "Cantidad Consolidada"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((g) => (
                  <tr key={`${g.Insumo}-${g.Unidad}`} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">
                      {localizeMaterialName(g.Insumo, lang)}
                    </td>
                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {unitLabel(g.Unidad)}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-slate-900">
                      {formatQty(g.Total, g.Unidad)}
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
