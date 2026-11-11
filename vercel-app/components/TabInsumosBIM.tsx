"use client";

import React, { useMemo, useState } from "react";
import { formatNum } from "../lib/projects";
import { ConsolidationResult, ProjectConfig } from "../lib/types";

interface TabInsumosBIMProps {
  proyecto: ProjectConfig;
  data: ConsolidationResult;
}

export default function TabInsumosBIM({ proyecto, data }: TabInsumosBIMProps) {
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
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            🧱 Explosión Paramétrica de Insumos BIM & Compras (Take-Off)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Dosificación automática de cemento, arena, acero, porcelanato, pintura y bloques desde los metrados del proyecto.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setModo("demanda")}
            className={`px-3.5 py-2 rounded-lg transition-all ${
              modo === "demanda"
                ? "steel-btn-primary text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📦 Demanda Total de Obra
          </button>
          <button
            type="button"
            onClick={() => setModo("ejecutado")}
            className={`px-3.5 py-2 rounded-lg transition-all ${
              modo === "ejecutado"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🚧 Consumo Teórico Ejecutado
          </button>
        </div>
      </div>

      {proyecto.id === "casa_mendoza" && (
        <div className="steel-subcard rounded-2xl p-4 text-xs text-slate-900">
          <div className="font-extrabold text-sm mb-1">
            🏡 Sincronización BIM Revit 2027 (Casa Mendoza 1.1.rvt)
          </div>
          <p className="text-slate-700">
            Cuando se cargan registros con etiqueta <code>[BIM_TAKEOFF]</code> desde la app de campo o Revit, las cantidades contratadas de Mampostería, Pisos, Pañete y Cubierta se recalibran automáticamente sobre toda la explosión de insumos.
          </p>
        </div>
      )}

      <div className="bento-card">
        {grouped.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-500">
            No hay insumos calculados para el filtro seleccionado (sin avance ejecutado aún o actividades sin dosificación estándar).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold">
                <tr>
                  <th className="p-2.5">Insumo / Material de Obra</th>
                  <th className="p-2.5 text-center w-28">Unidad Compra</th>
                  <th className="p-2.5 text-right w-40">Cantidad Consolidada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((g) => (
                  <tr key={`${g.Insumo}-${g.Unidad}`} className="hover:bg-slate-50">
                    <td className="p-2.5 font-bold text-slate-900">{g.Insumo}</td>
                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {g.Unidad}
                    </td>
                    <td className="p-2.5 text-right font-mono font-extrabold text-slate-900">
                      {formatNum(g.Total)}
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
