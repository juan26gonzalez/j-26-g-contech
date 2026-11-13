"use client";

import React from "react";
import { resolverMetaApu } from "../lib/calcClient";
import { formatNum } from "../lib/projects";
import { ConsolidationResult } from "../lib/types";

interface TabRendimientoProps {
  data: ConsolidationResult;
}

export default function TabRendimiento({ data }: TabRendimientoProps) {
  const { rendimientos, df_5d = [] } = data;
  const hasReal = rendimientos.length > 0;
  const avgEff = hasReal
    ? rendimientos.reduce((a, r) => a + r["Eficiencia_%"], 0) / rendimientos.length
    : null;
  const alertas = rendimientos.filter((r) => r["Eficiencia_%"] < 90).length;

  return (
    <div className="space-y-5">
      <div className="bento-card">
        <h2 className="text-base font-extrabold text-slate-900">
          👥 Productividad de Mano de Obra & Eficiencia de Cuadrillas vs. APU
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Auditoría diaria real (excluyendo metrados base [BIM_TAKEOFF] y cronogramas MS Project) frente a rendimientos constructivos reales en Colombia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bento-card border-l-4 border-l-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-500">
            Frentes con Registro Diario
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
            {avgEff !== null ? `${avgEff.toFixed(1)}%` : "—"}
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
        <div className="mb-3">
          <h3 className="text-sm font-extrabold text-slate-900">
            📊 Desempeño Real Reportado en Bitácora de Campo
          </h3>
          <p className="text-[11px] text-slate-500">
            Agrupado por actividad y días calendario únicos reportados en obra.
          </p>
        </div>

        {!hasReal ? (
          <div className="py-8 px-4 text-center text-xs text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            Aún no hay jornadas diarias de avance físico reportadas en Bitácora para este proyecto.
            Cuando registres cantidades ejecutadas en campo, aquí verás el rendimiento promedio real por jornada.
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
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
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

      {df_5d.length > 0 && (
        <div className="bento-card">
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              📐 Línea Base de Rendimientos Constructivos APU (Presupuesto Vigente)
            </h3>
            <p className="text-[11px] text-slate-500">
              Estándares diarios realistas por cuadrilla tipo y duración estimada para ejecutar el metrado contratado del proyecto.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-800 text-white font-bold">
                <tr>
                  <th className="p-2.5">Ítem</th>
                  <th className="p-2.5">Actividad Contractual</th>
                  <th className="p-2.5 text-right">Metrado</th>
                  <th className="p-2.5">Cuadrilla Estándar</th>
                  <th className="p-2.5 text-right">Meta Diaria APU</th>
                  <th className="p-2.5 text-right">Jornadas Est. (1 Cuadr.)</th>
                  <th className="p-2.5 text-right">Ejecución Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {df_5d.map((item) => {
                  const meta = resolverMetaApu(item.Actividad, item.Unidad);
                  const cant = Number(item.Cantidad_Contratada || 0);
                  const estDias =
                    meta.meta_dia > 0 && cant > 0
                      ? Math.max(1, Math.ceil(cant / meta.meta_dia))
                      : 0;
                  return (
                    <tr key={`${item.Item}-${item.Actividad}`} className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-slate-700">
                        {item.Item}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        {item.Actividad}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700 whitespace-nowrap">
                        {formatNum(cant)} {item.Unidad}
                      </td>
                      <td className="p-2.5 text-slate-600">{meta.cuadrilla}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {meta.meta_dia} {meta.und}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-700">
                        {estDias} días
                      </td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-800">
                        {Number(item["Avance_%"] || 0).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
